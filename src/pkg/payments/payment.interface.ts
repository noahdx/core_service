export interface ICreateSessionParams {
  orderId: string; // Order public_id (UUID)
  amount: number; // minor units (piasters) e.g. 10000 for 100.00 EGP
  currency?: string; // default 'EGP'
  customer: {
    email: string;
    reference: string;
    name?: string;
  };
  merchantRedirect?: string;
  serverWebhook?: string;
  expireAt?: string; // ISO 8601
  description?: string;
  metadata?: Record<string, any>;
}

export interface ICreateSessionResult {
  sessionId: string;
  sessionUrl: string;
  expireAt: string;
  status: string;
  raw: any;
}

export interface ISessionDetailsResult {
  sessionId: string;
  status: string;
  amount: number;
  currency: string;
  capturedAmount?: number;
  refundedAmount?: number;
  raw: any;
}

export interface IRefundResult {
  transactionId?: string;
  status: string;
  amount: number;
  raw: any;
}

export interface IPaymentProvider {
  createSession(params: ICreateSessionParams): Promise<ICreateSessionResult>;
  getSession(sessionId: string): Promise<ISessionDetailsResult>;
  refundOrder(orderReference: string, amount: number, reason: string): Promise<IRefundResult>;
  verifyWebhookSignature(payload: any, signature: string, secret?: string): boolean;
}
