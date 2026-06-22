import serverlessHttp from 'serverless-http';
import { app } from '../http/app';

export const handler = serverlessHttp(app);
