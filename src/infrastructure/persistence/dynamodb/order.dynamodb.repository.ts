import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from './dynamodb.client';
import { OrderRepositoryPort } from '../../../domain/ports/order.repository.port';
import { Order } from '../../../domain/entities/order.entity';
import { OrderMapper } from '../mappers/order.mapper';
import { envConfig } from '../../../config/env.config';

export class OrderDynamoDbRepository implements OrderRepositoryPort {
  private readonly tableName = envConfig.aws.ordersTableName;

  async save(order: Order): Promise<void> {
    await dynamoDb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: OrderMapper.toRecord(order),
      }),
    );
  }

  async findById(id: string): Promise<Order | null> {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id },
      }),
    );
    return result.Item ? OrderMapper.toDomain(result.Item as Record<string, unknown>) : null;
  }

  async update(order: Order): Promise<void> {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: order.id },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': order.status,
          ':updatedAt': order.updatedAt,
        },
      }),
    );
  }
}
