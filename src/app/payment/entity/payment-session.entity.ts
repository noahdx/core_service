import { PaymentSessionStatus } from '../enums';

export class PaymentSessionEntity {
  id: number;
  orderId: number;
  providerId: number;
  providerSessionId: string;
  redirectUrl: string;
  amount: number;
  currency: string;
  status: PaymentSessionStatus;
  rawInitPayload?: any;
  rawLastPayload?: any;
  failureAttempts: number;
  maxFailureAttempts: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<PaymentSessionEntity>) {
    this.id = data.id!;
    this.orderId = Number(data.orderId);
    this.providerId = Number(data.providerId);
    this.providerSessionId = data.providerSessionId!;
    this.redirectUrl = data.redirectUrl!;
    this.amount = Number(data.amount);
    this.currency = data.currency || 'EGP';
    this.status = data.status!;
    this.rawInitPayload = data.rawInitPayload ?? null;
    this.rawLastPayload = data.rawLastPayload ?? null;
    this.failureAttempts = Number(data.failureAttempts ?? 0);
    this.maxFailureAttempts = Number(data.maxFailureAttempts ?? 3);
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
}
