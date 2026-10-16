import { PaymentMethodType, TransactionStatus, TransactionType } from '../enums';

export class TransactionEntity {
  id: number;
  orderId: number | null;
  transactionType: TransactionType;
  method: PaymentMethodType;
  providerId: number | null;
  providerReferenceId: string | null;
  status: TransactionStatus;
  amount: number;
  currency: string;
  srcAccId: number | null;
  dstAccId: number | null;
  isRefunded: boolean;
  refundedPaymentId: number | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<TransactionEntity>) {
    this.id = data.id!;
    this.orderId = data.orderId ? Number(data.orderId) : null;
    this.transactionType = data.transactionType!;
    this.method = data.method!;
    this.providerId = data.providerId ? Number(data.providerId) : null;
    this.providerReferenceId = data.providerReferenceId ?? null;
    this.status = data.status!;
    this.amount = Number(data.amount);
    this.currency = data.currency || 'EGP';
    this.srcAccId = data.srcAccId ? Number(data.srcAccId) : null;
    this.dstAccId = data.dstAccId ? Number(data.dstAccId) : null;
    this.isRefunded = Boolean(data.isRefunded);
    this.refundedPaymentId = data.refundedPaymentId ? Number(data.refundedPaymentId) : null;
    this.idempotencyKey = data.idempotencyKey ?? null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
}
