export interface IKashierConfig {
  baseUrl: string;
  merchantId: string;
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  returnUrl?: string;
  failUrl?: string;
  sessionTimeoutMin: number;
}

export interface IKashierCustomer {
  email: string;
  reference: string;
  name?: string;
}

export interface IKashierSessionRequest {
  expireAt: string;
  maxFailureAttempts: number;
  paymentType: 'credit' | 'debit';
  amount: string; // Kashier expects decimal string e.g. "100.00"
  currency: string;
  order: string; // Order public_id
  merchantRedirect?: string;
  failureRedirect?: string;
  display?: string;
  type?: string;
  allowedMethods?: string;
  merchantId: string;
  description?: string;
  manualCapture?: boolean;
  customer: IKashierCustomer;
  serverWebhook?: string;
  metaData?: Record<string, any>;
}

export interface IKashierSessionResponse {
  _id: string;
  sessionUrl: string;
  status: string;
  expireAt: string;
  failureAttempts?: number;
  capturedAmount?: number;
  refundedAmount?: number;
  merchantId?: string;
  order?: string;
  [key: string]: any;
}

export interface IKashierWebhookData {
  amount: number | string;
  currency: string;
  channel?: string;
  kashierOrderId?: string;
  merchantOrderId?: string;
  orderReference: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  transactionId: string;
  transactionResponseCode?: string;
  method?: string;
  signatureKeys?: string[];
  customer?: {
    email?: string;
    reference?: string;
  };
  [key: string]: any;
}

export interface IKashierWebhookPayload {
  event: 'pay' | 'authorize' | 'capture' | 'refund' | 'partial_refund' | 'void' | 'reject' | 'reversal' | string;
  data: IKashierWebhookData;
}
