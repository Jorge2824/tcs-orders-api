import { Currency } from '../../../shared/constants/currency.constants';

export interface CreateOrderDto {
  customerId: string;
  amount: number;
  currency: Currency;
}
