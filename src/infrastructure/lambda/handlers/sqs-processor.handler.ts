import { SQSHandler } from 'aws-lambda';
import { ProcessOrderUseCase } from '../../../application/use-cases/process-order/process-order.use-case';
import { OrderDynamoDbRepository } from '../../persistence/dynamodb/order.dynamodb.repository';
import { AuditLogDynamoDbRepository } from '../../persistence/dynamodb/audit-log.dynamodb.repository';
import { InvalidOrderTransitionException } from '../../../domain/exceptions/invalid-order-transition.exception';

const useCase = new ProcessOrderUseCase(
  new OrderDynamoDbRepository(),
  new AuditLogDynamoDbRepository(),
);

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { orderId } = JSON.parse(record.body) as { orderId: string };
    try {
      await useCase.execute(orderId);
      console.log(`[SQS] Orden ${orderId} procesada exitosamente`);
    } catch (error) {
      if (error instanceof InvalidOrderTransitionException) {
        console.warn(`[SQS] Orden ${orderId} omitida: ${(error as Error).message}`);
        continue;
      }
      console.error(`[SQS] Error al procesar orden ${orderId}:`, (error as Error).message);
      throw error;
    }
  }
};
