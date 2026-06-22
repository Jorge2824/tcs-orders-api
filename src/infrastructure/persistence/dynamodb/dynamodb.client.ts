import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { envConfig } from '../../../config/env.config';

const localConfig = envConfig.aws.dynamodbEndpoint
  ? {
      endpoint: envConfig.aws.dynamodbEndpoint,
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    }
  : {};

const client = new DynamoDBClient({
  region: envConfig.aws.region,
  ...localConfig,
});

export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
