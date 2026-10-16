import { TransactionEntity } from '../../payment/entity/transaction.entity';

export class RestaurantBalanceResponseDTO {
  restaurantId!: number;
  balance!: number;
  currency!: string;
  asOf!: string;

  static from(restaurantId: number, balance: number, currency: string = 'EGP'): RestaurantBalanceResponseDTO {
    return {
      restaurantId,
      balance,
      currency,
      asOf: new Date().toISOString(),
    };
  }
}

export class PayoutResponseDTO {
  id!: number;
  restaurantId!: number;
  amount!: number;
  currency!: string;
  method!: string;
  status!: string;
  providerReferenceId!: string | null;
  createdAt!: string;

  static from(tx: TransactionEntity, restaurantId: number): PayoutResponseDTO {
    return {
      id: tx.id,
      restaurantId,
      amount: tx.amount,
      currency: tx.currency,
      method: tx.method,
      status: tx.status,
      providerReferenceId: tx.providerReferenceId,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
