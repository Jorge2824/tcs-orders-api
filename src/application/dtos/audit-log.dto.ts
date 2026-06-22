import { OrderStatus } from '../../shared/constants/order-status.constants';
import { AuditEvent } from '../../shared/constants/audit-events.constants';

export interface AuditLogDto {
  id: string;
  orderId: string;
  event: AuditEvent;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  timestamp: string;
}
