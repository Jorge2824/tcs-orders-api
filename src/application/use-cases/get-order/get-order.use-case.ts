import { OrderRepositoryPort } from '../../../domain/ports/order.repository.port';
import { AuditRepositoryPort } from '../../../domain/ports/audit.repository.port';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';
import { OrderWithAuditDto } from '../../dtos/order-with-audit.dto';

export class GetOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly auditRepository: AuditRepositoryPort,
  ) {}

  async execute(orderId: string): Promise<OrderWithAuditDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    const auditLogs = await this.auditRepository.findByOrderId(orderId);

    return { ...order, auditLogs };
  }
}
