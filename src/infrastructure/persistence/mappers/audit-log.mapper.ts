import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { OrderStatus } from '../../../shared/constants/order-status.constants';
import { AuditEvent } from '../../../shared/constants/audit-events.constants';

export class AuditLogMapper {
  static toRecord(log: AuditLog): Record<string, unknown> {
    return { ...log };
  }

  static toDomain(record: Record<string, unknown>): AuditLog {
    return {
      id: record['id'] as string,
      orderId: record['orderId'] as string,
      event: record['event'] as AuditEvent,
      previousStatus: record['previousStatus'] ? (record['previousStatus'] as OrderStatus) : null,
      newStatus: record['newStatus'] as OrderStatus,
      timestamp: record['timestamp'] as string,
    };
  }
}
