export enum PaymentSessionStatus {
  INITIALIZED = 'initialized',
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum TransactionType {
  CHARGE = 'charge',
  REFUND = 'refund',
  COMMISSION = 'commission',
  PAYOUT = 'payout',
  COD_COLLECTION = 'cod_collection',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PaymentMethodType {
  ONLINE = 'online',
  COD = 'cod',
  BANK_TRANSFER = 'bank_transfer',
  SYSTEM = 'system',
}

export enum PaymentProviderName {
  KASHIER = 'kashier',
  COD = 'cod',
}

export const KASHIER_PROVIDER_ID = 1;
export const COD_PROVIDER_ID = 2;
