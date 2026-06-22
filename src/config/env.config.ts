export const envConfig = {
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  aws: {
    region: process.env.AWS_REGION ?? 'us-east-1',
    dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT,
    sqsEndpoint: process.env.SQS_ENDPOINT,
    ordersTableName: process.env.ORDERS_TABLE_NAME ?? 'orders',
    auditLogsTableName: process.env.AUDIT_LOGS_TABLE_NAME ?? 'audit_logs',
    ordersQueueUrl: process.env.ORDERS_QUEUE_URL ?? '',
  },
  auth: {
    bearerToken: process.env.BEARER_TOKEN ?? 'dev-secret-token',
  },
};
