import { AuditLog } from '../entities/audit-log.entity';

export interface AuditRepositoryPort {
  save(log: AuditLog): Promise<void>;
  findByOrderId(orderId: string): Promise<AuditLog[]>;
}
