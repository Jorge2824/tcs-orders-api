import { CreateOrderUseCase } from '../../../application/use-cases/create-order/create-order.use-case';
import { GetOrderUseCase } from '../../../application/use-cases/get-order/get-order.use-case';
import { ProcessOrderUseCase } from '../../../application/use-cases/process-order/process-order.use-case';
import { CreateOrderDto } from '../../../application/use-cases/create-order/create-order.dto';
import { OrderDynamoDbRepository } from '../../persistence/dynamodb/order.dynamodb.repository';
import { AuditLogDynamoDbRepository } from '../../persistence/dynamodb/audit-log.dynamodb.repository';
import { OrderQueueSqsAdapter } from '../../messaging/sqs/order-queue.sqs.adapter';
import { HTTP_STATUS } from '../../../shared/constants/http-status.constants';
import { createHttpHandler } from '../utils/http-handler.util';

const orderRepository = new OrderDynamoDbRepository();
const auditRepository = new AuditLogDynamoDbRepository();
const orderQueue = new OrderQueueSqsAdapter();

const createOrderUseCase = new CreateOrderUseCase(orderRepository, auditRepository, orderQueue);
const getOrderUseCase = new GetOrderUseCase(orderRepository, auditRepository);
const processOrderUseCase = new ProcessOrderUseCase(orderRepository, auditRepository);

export const createOrderHandler = createHttpHandler(HTTP_STATUS.CREATED, (req) =>
  createOrderUseCase.execute(req.body as CreateOrderDto),
);

export const getOrderHandler = createHttpHandler(HTTP_STATUS.OK, (req) =>
  getOrderUseCase.execute(req.params['id'] as string),
);

export const processOrderHandler = createHttpHandler(HTTP_STATUS.ACCEPTED, async (req) => {
  await processOrderUseCase.execute(req.params['id'] as string);
  return { mensaje: 'Procesamiento de orden completado' };
});
