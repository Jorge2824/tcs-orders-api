import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { OrderRepositoryPort } from '../../../domain/ports/order.repository.port';
import { AuditRepositoryPort } from '../../../domain/ports/audit.repository.port';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';
import { InvalidOrderTransitionException } from '../../../domain/exceptions/invalid-order-transition.exception';
import { OrderStatus, VALID_TRANSITIONS } from '../../../shared/constants/order-status.constants';
import { AuditEvent } from '../../../shared/constants/audit-events.constants';

export class ProcessOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly auditRepository: AuditRepositoryPort,
  ) {}

  async execute(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new OrderNotFoundException(orderId);

    if (!VALID_TRANSITIONS[order.status].includes(OrderStatus.PROCESSING)) {
      throw new InvalidOrderTransitionException(order.status, OrderStatus.PROCESSING);
    }

    const processingAt = new Date().toISOString();
    const processingOrder = { ...order, status: OrderStatus.PROCESSING, updatedAt: processingAt };

    await this.orderRepository.update(processingOrder);
    await this.auditRepository.save({
      id: uuidv4(),
      orderId,
      event: AuditEvent.ORDER_PROCESSING,
      previousStatus: order.status,
      newStatus: OrderStatus.PROCESSING,
      timestamp: processingAt,
    } as AuditLog);

    try {
      await this.simulateProcessing();

      const completedAt = new Date().toISOString();
      await this.orderRepository.update({ ...processingOrder, status: OrderStatus.COMPLETED, updatedAt: completedAt });
      await this.auditRepository.save({
        id: uuidv4(),
        orderId,
        event: AuditEvent.ORDER_COMPLETED,
        previousStatus: OrderStatus.PROCESSING,
        newStatus: OrderStatus.COMPLETED,
        timestamp: completedAt,
      } as AuditLog);
    } catch (error) {
      const failedAt = new Date().toISOString();
      await this.orderRepository.update({ ...processingOrder, status: OrderStatus.FAILED, updatedAt: failedAt });
      await this.auditRepository.save({
        id: uuidv4(),
        orderId,
        event: AuditEvent.ORDER_FAILED,
        previousStatus: OrderStatus.PROCESSING,
        newStatus: OrderStatus.FAILED,
        timestamp: failedAt,
      } as AuditLog);
      throw error;
    }
  }

  private async simulateProcessing(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (Math.random() < 0.1) {
      throw new Error('Fallo de procesamiento: timeout del gateway de pagos');
    }
  }
}
