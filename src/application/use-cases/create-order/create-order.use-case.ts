import { v4 as uuidv4 } from 'uuid';
import { Order } from '../../../domain/entities/order.entity';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { OrderRepositoryPort } from '../../../domain/ports/order.repository.port';
import { AuditRepositoryPort } from '../../../domain/ports/audit.repository.port';
import { OrderQueuePort } from '../../../domain/ports/order-queue.port';
import { OrderStatus } from '../../../shared/constants/order-status.constants';
import { AuditEvent } from '../../../shared/constants/audit-events.constants';
import { Currency } from '../../../shared/constants/currency.constants';
import { ValidationException } from '../../../shared/exceptions/validation.exception';
import { CreateOrderDto } from './create-order.dto';
import { OrderDto } from '../../dtos/order.dto';

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly auditRepository: AuditRepositoryPort,
    private readonly orderQueue: OrderQueuePort,
  ) {}

  async execute(dto: CreateOrderDto): Promise<OrderDto> {
    this.validate(dto);

    const now = new Date().toISOString();
    const order: Order = {
      id: uuidv4(),
      customerId: dto.customerId,
      amount: dto.amount,
      currency: dto.currency,
      status: OrderStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    await this.orderRepository.save(order);

    const auditLog: AuditLog = {
      id: uuidv4(),
      orderId: order.id,
      event: AuditEvent.ORDER_CREATED,
      previousStatus: null,
      newStatus: OrderStatus.PENDING,
      timestamp: now,
    };

    await this.auditRepository.save(auditLog);
    await this.orderQueue.enqueue(order.id);

    return order;
  }

  private validate(dto: CreateOrderDto): void {
    if (!dto.customerId?.trim()) {
      throw new ValidationException("El campo 'customerId' es requerido");
    }
    if (typeof dto.amount !== 'number' || isNaN(dto.amount) || dto.amount <= 0) {
      throw new ValidationException("El campo 'amount' debe ser un número positivo");
    }
    if (!Object.values(Currency).includes(dto.currency)) {
      throw new ValidationException(
        `Moneda no soportada. Valores permitidos: ${Object.values(Currency).join(', ')}`,
      );
    }
  }
}
