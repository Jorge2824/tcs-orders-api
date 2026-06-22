import { OrderStatus } from '../../shared/constants/order-status.constants';

export class InvalidOrderTransitionException extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Transición de orden inválida: ${from} → ${to}`);
    this.name = 'InvalidOrderTransitionException';
  }
}
