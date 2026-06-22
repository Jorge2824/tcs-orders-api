import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '../../../shared/constants/order-status.constants';
import { Currency } from '../../../shared/constants/currency.constants';

export class OrderMapper {
  static toRecord(order: Order): Record<string, unknown> {
    return { ...order };
  }

  static toDomain(record: Record<string, unknown>): Order {
    return {
      id: record['id'] as string,
      customerId: record['customerId'] as string,
      amount: record['amount'] as number,
      currency: record['currency'] as Currency,
      status: record['status'] as OrderStatus,
      createdAt: record['createdAt'] as string,
      updatedAt: record['updatedAt'] as string,
    };
  }
}
