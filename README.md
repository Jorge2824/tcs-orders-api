# TCS Orders API

Plataforma de procesamiento de órdenes para comercios digitales — Prueba Técnica TCS.

---

## Decisiones de arquitectura

### Base de datos: DynamoDB (NoSQL)

Se eligió DynamoDB sobre una base de datos relacional porque:

- **Los patrones de acceso son clave-valor**: toda lectura y escritura es por `orderId` (PK). No se necesitan JOINs.
- **La auditoría es append-only**: una tabla DynamoDB con `orderId` (PK) + `timestamp` (SK) entrega historial ordenado — es el modelo natural para event sourcing.
- **Nativo de AWS sin servidor**: escala automáticamente junto a Lambda sin gestión de conexiones.
- **SQL tendría sentido** si se necesitaran consultas complejas, reportes o transacciones entre múltiples entidades. En este caso agregaría complejidad operacional innecesaria.

### Cómputo: Lambda + API Gateway

Se eligió Lambda sobre ECS Fargate porque:

- **Operaciones sin estado y de corta duración**: cada endpoint ejecuta en milisegundos. Lambda cobra por invocación — ideal para este patrón.
- **Integración nativa con SQS**: el mapeo de fuente de eventos SQS → Lambda no requiere polling.
- **Mismo código local y en AWS**: la app Express se envuelve con `serverless-http` para Lambda. No hay adaptadores duplicados.

### Procesamiento asíncrono: SQS

Al crear una orden, su ID se encola en SQS. La Lambda `sqs-processor` consume la cola y ejecuta la transición completa `PENDING → PROCESSING → COMPLETED/FAILED` de forma automática.

Esto garantiza:
- `POST /orders` responde en milisegundos (fire-and-forget).
- Los fallos de procesamiento se reintentan automáticamente (hasta 3 veces) antes de ir a la Cola de Mensajes Fallidos (DLQ).
- El sistema es resiliente ante picos de carga.

### IaC: AWS CDK (TypeScript)

CDK comparte el mismo lenguaje que la aplicación, manteniendo todo el stack en un repositorio. Provee definiciones de recursos type-safe y es más expresivo que CloudFormation YAML puro.

### Arquitectura Hexagonal (Puertos y Adaptadores)

```
src/
├── domain/          # Entidades, Puertos (interfaces), Excepciones de dominio
├── application/     # Casos de uso, DTOs de aplicación
├── infrastructure/  # Adaptadores: DynamoDB, SQS, HTTP (Express), Lambda
└── shared/          # Constantes (enums), Utilidades, Excepciones compartidas
```

El dominio **no tiene dependencias de AWS ni Express**. Los adaptadores implementan las interfaces de los puertos. Los casos de uso reciben sus dependencias por inyección — completamente testeables en aislamiento.

### Estados de la orden

Los estados se almacenan como valores numéricos en DynamoDB para evitar strings mágicos. En código se usan enums TypeScript:

```
OrderStatus.PENDING (1) ──► OrderStatus.PROCESSING (2) ──► OrderStatus.COMPLETED (3)
                                                       └──► OrderStatus.FAILED (4)
```

Definido en `VALID_TRANSITIONS` y protegido en `ProcessOrderUseCase`. Las transiciones inválidas lanzan `InvalidOrderTransitionException` → HTTP 409.

### Versionado de API

El prefijo `/v1` vive en el **stage de API Gateway**, no en las rutas de Express. Si en el futuro se necesita una versión `/v2`, se crea un nuevo stage apuntando a otro Lambda — Express no sabe nada de versiones.

---

## Escenario AWS

```
                     ┌──────────────────────────────────────┐
Cliente              │          API Gateway  (stage: v1)     │
  │  POST /orders    │                                       │
  ├────────────────► │                                       │
  │  GET /orders/:id │         ┌──────────────────┐          │
  ├────────────────► │         │   OrdersApiFn    │          │
  │  POST /:id/proc  │         │ (Express via     │          │
  └────────────────► │         │  serverless-http)│          │
                     │         └────────┬─────────┘          │
                     └──────────────────┼────────────────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          │             │              │
                       Escribir      Leer/         Encolar
                       auditoría    actualizar    orderId
                          │             │              │
                          ▼             ▼              ▼
                     ┌──────────┐  ┌──────────┐  ┌──────────┐
                     │ DynamoDB │  │ DynamoDB │  │   SQS    │
                     │audit_logs│  │  orders  │  │  Queue   │
                     └──────────┘  └──────────┘  └────┬─────┘
                                                       │ Trigger
                                                       ▼
                                               ┌──────────────┐
                                               │SqsProcessorFn│
                                               │(auto-procesa │
                                               │  la orden)   │
                                               └──────────────┘
```

**Flujo completo al crear una orden:**

1. `POST /v1/orders` → Lambda recibe el request a través de API Gateway
2. Express ejecuta `CreateOrderUseCase`: persiste la orden en DynamoDB con `status: 1 (PENDING)` y registra auditoría `ORDER_CREATED`
3. El `orderId` se encola en SQS — el cliente recibe respuesta `201` inmediatamente
4. En paralelo, `SqsProcessorFn` se dispara automáticamente: ejecuta `PENDING → PROCESSING → COMPLETED` (o `FAILED`) y registra cada transición en la tabla de auditoría

**Al consultar la orden después:** el estado ya refleja el resultado del procesamiento asíncrono.

---

## Configuración local con Docker

### Prerrequisitos

- Docker Desktop
- Docker Compose v2

### Levantar el stack completo

```bash
cp .env.example .env
docker compose up --build
```

Esto inicia:
1. **DynamoDB Local** — crea las tablas `orders` y `audit_logs`
2. **ElasticMQ** — emulador SQS open-source, la cola `orders-queue` se configura vía `docker/elasticmq.conf`
3. **tcs-orders-api** — servidor Express en el puerto 3000

> **Nota:** Se usa ElasticMQ en lugar de LocalStack porque la versión `latest` de LocalStack requiere licencia pro. ElasticMQ es 100% open-source, sin registro ni cuenta.

### Acceso

| Recurso | URL |
|---|---|
| API | `http://localhost:3000` |
| Swagger UI | `http://localhost:3000/api-docs` |
| Health check | `http://localhost:3000/health` |

### Detener

```bash
docker compose down
```

---

## Uso de la API — Entorno local

Todos los endpoints requieren `Authorization: Bearer dev-secret-token` (configurable con la variable de entorno `BEARER_TOKEN`).

### Crear una orden

```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cliente-123", "amount": 199.99, "currency": "USD"}'
```

Respuesta `201`:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cliente-123",
    "amount": 199.99,
    "currency": "USD",
    "status": 1,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

> `status: 1` = PENDING. En local (Docker) el procesamiento SQS no se dispara automáticamente; usar el endpoint de procesar para ejecutarlo manualmente.

### Consultar una orden

```bash
curl http://localhost:3000/orders/{id} \
  -H "Authorization: Bearer dev-secret-token"
```

Respuesta `200`:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cliente-123",
    "amount": 199.99,
    "currency": "USD",
    "status": 3,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.001Z",
    "auditLogs": [
      { "event": 1, "previousStatus": null, "newStatus": 1, "timestamp": "..." },
      { "event": 2, "previousStatus": 1,    "newStatus": 2, "timestamp": "..." },
      { "event": 3, "previousStatus": 2,    "newStatus": 3, "timestamp": "..." }
    ]
  }
}
```

### Procesar una orden manualmente

```bash
curl -X POST http://localhost:3000/orders/{id}/process \
  -H "Authorization: Bearer dev-secret-token"
```

Respuesta `202`: la orden transiciona `PENDING → PROCESSING → COMPLETED` (o `FAILED` con ~10% de probabilidad para simular errores reales).

### Referencia de estados

| Valor numérico | Nombre | Descripción |
|---|---|---|
| `1` | PENDING | Orden registrada, en espera de procesamiento |
| `2` | PROCESSING | En proceso de aprobación |
| `3` | COMPLETED | Orden aprobada y completada |
| `4` | FAILED | Procesamiento fallido |

### Monedas soportadas

| Valor | Descripción |
|---|---|
| `PEN` | Soles peruanos |
| `USD` | Dólares americanos |

### Códigos HTTP de respuesta

| Código | Descripción |
|---|---|
| 200 | Consulta exitosa |
| 201 | Orden creada |
| 202 | Procesamiento completado |
| 400 | Datos inválidos o campos requeridos ausentes |
| 401 | Token de autorización ausente o inválido |
| 404 | Orden no encontrada |
| 409 | Transición de estado inválida |
| 500 | Error interno del servidor |

---

## Despliegue en AWS con CDK

### Prerrequisitos

- Node.js 20+
- AWS CLI instalado

### 1. Configurar credenciales AWS

```bash
aws configure --profile devsecops-admin
# AWS Access Key ID: tu-access-key
# AWS Secret Access Key: tu-secret-key
# Default region name: us-east-1
# Default output format: json
```

> Para verificar que las credenciales son correctas:
> ```bash
> aws sts get-caller-identity --profile devsecops-admin
> ```

### 2. Instalar dependencias del CDK

```bash
cd infrastructure/cdk
npm install
```

### 3. Bootstrap (solo la primera vez por cuenta/región)

```bash
npx cdk bootstrap --profile devsecops-admin
```

Crea el bucket S3 y los roles IAM que CDK necesita para desplegar assets en tu cuenta.

### 4. Desplegar

```bash
npx cdk deploy --profile devsecops-admin
```

Para un token personalizado en producción:

```bash
BEARER_TOKEN=mi-token-secreto npx cdk deploy --profile devsecops-admin
```

CDK imprimirá al finalizar:

```
Outputs:
TcsOrdersStack.ApiGatewayUrl = https://{api-id}.execute-api.us-east-1.amazonaws.com/v1/
TcsOrdersStack.OrdersQueueUrl = https://sqs.us-east-1.amazonaws.com/{account}/orders-queue
```

---

## Uso de la API — Entorno AWS desplegado

Base URL: `https://uh6lewjj66.execute-api.us-east-1.amazonaws.com/v1`

### Crear una orden

```bash
curl -X POST https://uh6lewjj66.execute-api.us-east-1.amazonaws.com/v1/orders \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cliente-123", "amount": 199.99, "currency": "USD"}'
```

### Consultar una orden

```bash
curl https://uh6lewjj66.execute-api.us-east-1.amazonaws.com/v1/orders/6f2f89bc-f7da-4052-bce3-92826d587f26 \
  -H "Authorization: Bearer dev-secret-token"
```

Respuesta real obtenida tras el despliegue:
```json
{
  "success": true,
  "data": {
    "id": "6f2f89bc-f7da-4052-bce3-92826d587f26",
    "customerId": "customer-123",
    "amount": 199.99,
    "currency": "USD",
    "status": 3,
    "createdAt": "2026-06-22T08:19:49.171Z",
    "updatedAt": "2026-06-22T08:19:49.882Z",
    "auditLogs": [
      { "event": 1, "previousStatus": null, "newStatus": 1, "timestamp": "2026-06-22T08:19:49.171Z" },
      { "event": 2, "previousStatus": 1,    "newStatus": 2, "timestamp": "2026-06-22T08:19:49.642Z" },
      { "event": 3, "previousStatus": 2,    "newStatus": 3, "timestamp": "2026-06-22T08:19:49.882Z" }
    ]
  }
}
```

> **Por qué la orden ya aparece en `COMPLETED` al consultarla:** al crear la orden, su ID se encola en SQS. La Lambda `SqsProcessorFn` se dispara automáticamente en milisegundos y ejecuta todo el ciclo de vida `PENDING → PROCESSING → COMPLETED`. El cliente recibe el `201` de forma inmediata (fire-and-forget) y el procesamiento ocurre en paralelo.

### Procesar una orden manualmente

```bash
curl -X POST https://uh6lewjj66.execute-api.us-east-1.amazonaws.com/v1/orders/{id}/process \
  -H "Authorization: Bearer dev-secret-token"
```

> En AWS este endpoint es redundante porque el procesamiento ya ocurrió vía SQS. Es útil para reprocessar órdenes en estado `FAILED` o para pruebas puntuales.

### Health check

```bash
curl https://uh6lewjj66.execute-api.us-east-1.amazonaws.com/v1/health
```

---

## Posibles mejoras

| Área | Mejora |
|---|---|
| Autenticación | Reemplazar Bearer mock con Cognito User Pool + autorizador de API Gateway |
| Observabilidad | Logging estructurado con CloudWatch (Winston) + trazado con X-Ray |
| Validación | Reemplazar validación manual con esquemas Zod |
| Pruebas | Tests unitarios para casos de uso (repositorios en memoria), tests de integración con DynamoDB Local |
| CI/CD | GitHub Actions: lint → test → build → cdk deploy |
| DynamoDB | Agregar GSI en `customerId` para consulta "listar órdenes por cliente" |
| Seguridad | API Gateway usage plans + WAF para protección DDoS |
| Secretos | Almacenar `BEARER_TOKEN` en AWS Secrets Manager, inyectado en Lambda vía env al desplegar |
