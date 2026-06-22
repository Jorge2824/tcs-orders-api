import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from './dynamodb.client';
import { AuditRepositoryPort } from '../../../domain/ports/audit.repository.port';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { AuditLogMapper } from '../mappers/audit-log.mapper';
import { envConfig } from '../../../config/env.config';

export class AuditLogDynamoDbRepository implements AuditRepositoryPort {
  private readonly tableName = envConfig.aws.auditLogsTableName;

  async save(log: AuditLog): Promise<void> {
    await dynamoDb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: AuditLogMapper.toRecord(log),
      }),
    );
  }

  async findByOrderId(orderId: string): Promise<AuditLog[]> {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'orderId = :orderId',
        ExpressionAttributeValues: { ':orderId': orderId },
        ScanIndexForward: true,
      }),
    );
    return (result.Items ?? []).map((item) =>
      AuditLogMapper.toDomain(item as Record<string, unknown>),
    );
  }
}
