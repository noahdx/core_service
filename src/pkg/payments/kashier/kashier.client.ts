import { injectable } from 'tsyringe';
import { env } from '../../../lib/config/env';
import {
  ICreateSessionParams,
  ICreateSessionResult,
  IPaymentProvider,
  IRefundResult,
  ISessionDetailsResult,
} from '../payment.interface';
import { KashierSignature } from './kashier.signature';
import { IKashierConfig, IKashierSessionRequest, IKashierSessionResponse } from './kashier.types';

@injectable()
export class KashierClient implements IPaymentProvider {
  private config: IKashierConfig;

  constructor() {
    this.config = {
      baseUrl: (env.kashier.baseUrl || 'https://test-api.kashier.io').replace(/\/+$/, ''),
      merchantId: env.kashier.merchantId || 'MID-XXXX-XXXX',
      apiKey: env.kashier.apiKey || 'pk_test_xxx',
      secretKey: env.kashier.secretKey || 'sk_test_xxx',
      webhookSecret: env.kashier.webhookSecret || env.kashier.apiKey || 'whsec_xxx',
      returnUrl: env.kashier.returnUrl,
      failUrl: env.kashier.failUrl,
      sessionTimeoutMin: env.kashier.sessionTimeoutMin || 15,
    };
  }

  createSession = async (params: ICreateSessionParams): Promise<ICreateSessionResult> => {
    const expireDate = params.expireAt
      ? new Date(params.expireAt)
      : new Date(Date.now() + this.config.sessionTimeoutMin * 60 * 1000);

    // Minor units (e.g. 10000 piasters) to decimal string ("100.00")
    const decimalAmount = (params.amount / 100).toFixed(2);

    const body: IKashierSessionRequest = {
      merchantId: this.config.merchantId,
      order: params.orderId,
      amount: decimalAmount,
      currency: params.currency || 'EGP',
      paymentType: 'credit',
      maxFailureAttempts: 3,
      expireAt: expireDate.toISOString(),
      customer: {
        email: params.customer.email,
        reference: params.customer.reference,
        name: params.customer.name,
      },
      merchantRedirect: params.merchantRedirect || this.config.returnUrl || 'https://app.example.com/checkout/return',
      failureRedirect: this.config.failUrl || 'https://app.example.com/checkout/failed',
      serverWebhook: params.serverWebhook,
      description: params.description || `Order ${params.orderId}`,
      manualCapture: false,
      metaData: params.metadata,
    };

    const res = await fetch(`${this.config.baseUrl}/v3/payment/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.config.secretKey,
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as IKashierSessionResponse;

    if (!res.ok) {
      const errMessage = (data as any)?.error?.message || (data as any)?.message || JSON.stringify(data);
      throw new Error(`Kashier session creation failed: ${errMessage}`);
    }

    return {
      sessionId: data._id,
      sessionUrl: data.sessionUrl,
      expireAt: data.expireAt || expireDate.toISOString(),
      status: data.status || 'CREATED',
      raw: data,
    };
  };

  getSession = async (sessionId: string): Promise<ISessionDetailsResult> => {
    const res = await fetch(`${this.config.baseUrl}/v3/payment/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: this.config.secretKey,
        'api-key': this.config.apiKey,
      },
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      const errMessage = data?.error?.message || data?.message || JSON.stringify(data);
      throw new Error(`Kashier get session failed: ${errMessage}`);
    }

    return {
      sessionId: data._id || sessionId,
      status: data.status,
      amount: Math.round(Number(data.amount || 0) * 100),
      currency: data.currency || 'EGP',
      capturedAmount: data.capturedAmount ? Math.round(Number(data.capturedAmount) * 100) : undefined,
      refundedAmount: data.refundedAmount ? Math.round(Number(data.refundedAmount) * 100) : undefined,
      raw: data,
    };
  };

  refundOrder = async (orderReference: string, amount: number, reason: string): Promise<IRefundResult> => {
    const decimalAmount = (amount / 100).toFixed(2);
    const body = {
      apiOperation: 'REFUND',
      reason,
      transaction: {
        amount: decimalAmount,
      },
    };

    const res = await fetch(`${this.config.baseUrl}/v3/orders/${orderReference}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.config.secretKey,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      const errMessage = data?.error?.message || data?.message || JSON.stringify(data);
      throw new Error(`Kashier refund failed: ${errMessage}`);
    }

    return {
      transactionId: data?.transaction?.transactionId || data?.transactionId,
      status: data?.status || 'SUCCESS',
      amount,
      raw: data,
    };
  };

  verifyWebhookSignature = (payload: any, signature: string, secret?: string): boolean => {
    const verificationSecret = secret || this.config.webhookSecret;
    return KashierSignature.verify(payload, signature, verificationSecret);
  };
}
