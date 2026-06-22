import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { OrderQueuePort } from '../../../domain/ports/order-queue.port';
import { envConfig } from '../../../config/env.config';

export class OrderQueueSqsAdapter implements OrderQueuePort {
  private readonly client: SQSClient;

  constructor() {
    const localConfig = envConfig.aws.sqsEndpoint
      ? {
          endpoint: envConfig.aws.sqsEndpoint,
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }
      : {};

    this.client = new SQSClient({
      region: envConfig.aws.region,
      ...localConfig,
    });
  }

  async enqueue(orderId: string): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: envConfig.aws.ordersQueueUrl,
        MessageBody: JSON.stringify({ orderId }),
      }),
    );
  }
}
