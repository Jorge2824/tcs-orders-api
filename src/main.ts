import { app } from './infrastructure/http/app';
import { envConfig } from './config/env.config';

const { port } = envConfig.app;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api-docs`);
});
