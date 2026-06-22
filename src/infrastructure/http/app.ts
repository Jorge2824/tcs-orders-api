import fs from 'fs';
import path from 'path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { orderRouter } from './router';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

app.use(express.json());

const swaggerPath = path.join(__dirname, '../../../docs/openapi.yaml');
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = YAML.load(swaggerPath) as object;
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(orderRouter);
app.use(errorMiddleware);

export { app };
