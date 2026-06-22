import { OrderStatus } from '../../shared/constants/order-status.constants';
import { Currency } from '../../shared/constants/currency.constants';

export interface OrderDto {
  id: string;
  customerId: string;
  amount: number;
  currency: Currency;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
