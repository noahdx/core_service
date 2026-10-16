import { IPaginationMeta } from '../../lib/http/pagination/cursor-pagination';
import { PaymentSessionEntity } from './entity/payment-session.entity';
import { PaymentSessionStatus } from './enums';

export interface IListRestaurantPaymentsFilter {
  restaurantId: number;
  status?: PaymentSessionStatus;
  from?: Date;
  to?: Date;
}

export interface IListPaymentsResult {
  data: PaymentSessionEntity[];
  meta: IPaginationMeta;
}
