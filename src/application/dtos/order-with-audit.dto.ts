import { OrderDto } from './order.dto';
import { AuditLogDto } from './audit-log.dto';

export interface OrderWithAuditDto extends OrderDto {
  auditLogs: AuditLogDto[];
}
