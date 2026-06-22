# TCS Orders API

Plataforma de procesamiento de órdenes para comercios digitales — Prueba Técnica TCS.

---

## Decisiones de arquitectura

### Base de datos: DynamoDB (NoSQL)

Se eligió DynamoDB sobre una base de datos relacional porque:

- **Los patrones de acceso son clave-valor**: toda lectura y escritura es por `orderId` (PK). No se necesitan JOINs.
- **La auditoría es append-only**: una tabla DynamoDB con `orderId` (PK) + `timestamp` (SK) entrega historial ordenado por orden — es el modelo natural para event sourcing.
- **Nativo de AWS sin servidor**: escala automáticamente junto a Lambda sin gestión de conexiones.
- **SQL tendría sentido** si se necesitaran consultas complejas (ej: "órdenes de un cliente en un rango de fechas"), reportes o transacciones entre múltiples entidades. En este caso agregaría complejidad operacional innecesaria.

### Cómputo: Lambda + API Gateway

Se eligió Lambda sobre ECS Fargate porque:

- **Operaciones sin estado y de corta duración**: cada endpoint ejecuta en milisegundos. Lambda cobra por invocación — ideal para este patrón.
- **Integración nativa con SQS**: el mapeo de fuente de eventos SQS → Lambda no requiere polling.
- **ECS Fargate es mejor cuando**: el workload es CPU-intensivo, requiere estado en memoria persistente, corre por minutos de forma continua, o tiene dependencias complejas de contenedor.

### Procesamiento asíncrono: SQS

Al crear una orden, su ID se encola en SQS. La Lambda `sqs-processor` consume la cola y ejecuta la transición completa `PENDING → PROCESSING → COMPLETED/FAILED`.

Esto garantiza:
- `POST /orders` responde rápido (fire-and-forget).
- Los fallos de procesamiento se reintentan automáticamente (hasta 3 veces) antes de ir a la Cola de Mensajes Fallidos (DLQ).
- El sistema es resiliente ante picos de carga.

### IaC: AWS CDK (TypeScript)

CDK comparte el mismo lenguaje que la aplicación, manteniendo todo el stack en un repositorio. Provee definiciones de recursos type-safe y es más expresivo que CloudFormation o Serverless Framework YAML.

### Arquitectura Hexagonal (Puertos y Adaptadores)

```
src/
├── domain/          # Entidades, Puertos (interfaces), Excepciones de dominio
├── application/     # Casos de uso, DTOs de aplicación
├── infrastructure/  # Adaptadores: DynamoDB, SQS, HTTP (Express), Lambda
└── shared/          # Constantes, Utilidades, Excepciones compartidas
```

El dominio **no tiene dependencias de AWS ni Express**. Los adaptadores implementan las interfaces de los puertos. Los casos de uso reciben sus dependencias por inyección — completamente testeables en aislamiento.

**Middlewares por adaptador:**
- `auth.middleware.ts` → adaptador HTTP (Express). Usa `auth.util.ts` para la comparación del token.
- `lambda-auth.util.ts` → adaptador Lambda. Usa la misma `auth.util.ts`.
- Procesador SQS → sin autenticación (IAM controla el acceso al servicio).

La lógica real de validación del token vive una sola vez en `shared/utils/auth.util.ts`.

### Máquina de estados

```
PENDING ──► PROCESSING ──► COMPLETED
                       └──► FAILED
```

Definida en `VALID_TRANSITIONS` (constantes) y protegida en `ProcessOrderUseCase`. Las transiciones inválidas lanzan `InvalidOrderTransitionException` → HTTP 409.

---

## Escenario AWS

```
                     ┌─────────────────────────────────────┐
Cliente              │          API Gateway                 │
  │  POST /orders    │  (REST API, rutas por Lambda)        │
  ├────────────────► │                                      │
  │  GET /orders/:id │  ┌────────────┐  ┌───────────────┐  │
  ├────────────────► │  │  Crear     │  │  Consultar    │  │
  │  POST /:id/proc  │  │  Orden     │  │  Orden        │  │
  └────────────────► │  │  Lambda    │  │  Lambda       │  │
                     │  └─────┬──────┘  └───────┬───────┘  │
                     └────────┼──────────────────┼──────────┘
                              │                  │
                     Encolar  │           Leer   │
                              ▼                  ▼
                           ┌──────┐         ┌──────────┐
                           │ SQS  │         │ DynamoDB │
                           │ Cola │         │          │
                           └──┬───┘         │ orders   │
                              │             │ audit_   │
                     Trigger  │             │ logs     │
                              ▼             └──────────┘
                      ┌─────────────┐
                      │ Procesador  │
                      │ SQS Lambda  │ ──► DynamoDB (actualizar)
                      └─────────────┘
```

**Decisiones clave para AWS:**

| Pregunta | Decisión | Razón |
|---|---|---|
| Lambda vs ECS | Lambda | Sin estado, corta duración, pago por invocación |
| Tipo de API Gateway | REST API | Integración Lambda por ruta; HTTP API también funciona |
| DLQ | Sí, 3 reintentos | Resiliencia ante fallos transitorios de procesamiento |
| PITR en tabla órdenes | Habilitado | Recuperación puntual para datos de producción |
| IAM para Lambda | Mínimo privilegio | Cada función solo recibe los permisos que necesita |

**Escalabilidad:** Lambda + DynamoDB escalan a millones de órdenes sin cambios de configuración. Para alto throughput, el batch size de SQS puede aumentarse y la concurrencia de Lambda puede reservarse.

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

> **Nota:** Se usa ElasticMQ en lugar de LocalStack porque la versión `latest` de LocalStack pasó a requerir licencia pro. ElasticMQ es 100% open-source, sin registro ni cuenta.

### Acceso

| Recurso | URL |
|---|---|
| API | `http://localhost:3000/api/v1` |
| Swagger UI | `http://localhost:3000/api-docs` |
| Health check | `http://localhost:3000/health` |

### Detener

```bash
docker compose down
```

---

## Uso de la API

Todos los endpoints requieren `Authorization: Bearer dev-secret-token` (configurable con la variable de entorno `BEARER_TOKEN`).

### Crear una orden

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cliente-123", "amount": 199.99, "currency": "USD"}'
```

Respuesta `201`:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-...",
    "customerId": "cliente-123",
    "amount": 199.99,
    "currency": "USD",
    "status": "PENDING",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Consultar una orden

```bash
curl http://localhost:3000/api/v1/orders/{id} \
  -H "Authorization: Bearer dev-secret-token"
```

Respuesta `200` — incluye la orden y el historial completo de auditoría (cambios de estado).

### Procesar una orden manualmente

```bash
curl -X POST http://localhost:3000/api/v1/orders/{id}/process \
  -H "Authorization: Bearer dev-secret-token"
```

Respuesta `202` — la orden transiciona por `PENDING → PROCESSING → COMPLETED` (o `FAILED` con ~10% de probabilidad para simular errores).

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

- AWS CLI configurado (`aws configure`)
- Node.js 20+

```bash
cd infrastructure/cdk
npm install
npx cdk bootstrap          # Solo la primera vez por cuenta/región
BEARER_TOKEN=tu-token-secreto npx cdk deploy
```

CDK imprimirá la URL de API Gateway después del despliegue.

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
| Versionado de API | Prefijo de versión manejado por variables de stage de API Gateway |
| Seguridad | API Gateway usage plans + WAF para protección DDoS |
| Secretos | Almacenar `BEARER_TOKEN` en AWS Secrets Manager, inyectado en Lambda vía env al desplegar |
