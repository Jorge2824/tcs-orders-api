import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { orderRouter } from './router';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, '../../../docs/openapi.yaml')) as object;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1', orderRouter);
app.use(errorMiddleware);

export { app };
