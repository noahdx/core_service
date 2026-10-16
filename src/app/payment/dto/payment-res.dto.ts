import { PaymentSessionEntity } from '../entity/payment-session.entity';
import { TransactionEntity } from '../entity/transaction.entity';
import { PaymentMethodType, PaymentSessionStatus, TransactionStatus, TransactionType } from '../enums';

export class PaymentInitResponseDTO {
  sessionId: string;
  redirectUrl: string;
  expireAt: string;

  constructor(data: { sessionId: string; redirectUrl: string; expireAt: string }) {
    this.sessionId = data.sessionId;
    this.redirectUrl = data.redirectUrl;
    this.expireAt = data.expireAt;
  }
}

export class TransactionSummaryDTO {
  id: number;
  type: TransactionType;
  method: PaymentMethodType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  providerReferenceId: string | null;
  createdAt: string;

  constructor(tx: TransactionEntity) {
    this.id = tx.id;
    this.type = tx.transactionType;
    this.method = tx.method;
    this.status = tx.status;
    this.amount = tx.amount;
    this.currency = tx.currency || 'EGP';
    this.providerReferenceId = tx.providerReferenceId;
    this.createdAt = tx.createdAt.toISOString();
  }
}

export class PaymentResponseDTO {
  id!: number;
  publicId!: string;
  orderId!: number;
  orderPublicId!: string;
  provider!: 'kashier' | 'cod';
  amount!: number;
  currency!: string;
  status!: PaymentSessionStatus;
  method!: string | null;
  createdAt!: string;
  paidAt!: string | null;
  transactions!: TransactionSummaryDTO[];

  static from(
    session: PaymentSessionEntity,
    orderPublicId: string,
    transactions: TransactionEntity[] = [],
  ): PaymentResponseDTO {
    const chargeTx = transactions.find(
      (t) => t.transactionType === TransactionType.CHARGE && t.status === TransactionStatus.SUCCEEDED,
    );

    const dto = new PaymentResponseDTO();
    dto.id = session.id;
    dto.publicId = session.providerSessionId;
    dto.orderId = session.orderId;
    dto.orderPublicId = orderPublicId;
    dto.provider = session.providerId === 2 ? 'cod' : 'kashier';
    dto.amount = session.amount;
    dto.currency = session.currency || 'EGP';
    dto.status = session.status;
    dto.method = chargeTx?.method || null;
    dto.createdAt = session.createdAt.toISOString();
    dto.paidAt = chargeTx ? chargeTx.createdAt.toISOString() : null;
    dto.transactions = transactions.map((t) => new TransactionSummaryDTO(t));
    return dto;
  }
}

export class RefundResponseDTO {
  refundId: number;
  paymentId: number;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;

  constructor(data: { refundId: number; paymentId: number; amount: number; currency?: string; status: string }) {
    this.refundId = data.refundId;
    this.paymentId = data.paymentId;
    this.amount = data.amount;
    this.currency = data.currency || 'EGP';
    this.status = data.status;
    this.createdAt = new Date().toISOString();
  }
}
