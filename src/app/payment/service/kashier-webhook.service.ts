import { inject, injectable } from 'tsyringe';
import { db } from '../../../lib/knex/knex';
import { TOKENS } from '../../../lib/di/tokens';
import { OrderRepository } from '../../order/repository/order.repository';
import { OrderStatus } from '../../order/types';
import {
  KASHIER_PROVIDER_ID,
  PaymentMethodType,
  PaymentSessionStatus,
  TransactionStatus,
  TransactionType,
} from '../enums';
import { InvalidWebhookSignatureError, PaymentSessionNotFoundError } from '../errors';
import { PaymentSessionRepository } from '../repository/payment-session.repository';
import { PaymentWebhookEventRepository } from '../repository/payment-webhook-event.repository';
import { TransactionRepository } from '../repository/transaction.repository';
import { IPaymentProvider } from '../../../pkg/payments/payment.interface';

@injectable()
export class KashierWebhookService {
  constructor(
    @inject(TOKENS.PaymentSessionRepository)
    private paymentSessionRepository: PaymentSessionRepository,
    @inject(TOKENS.TransactionRepository)
    private transactionRepository: TransactionRepository,
    @inject(TOKENS.PaymentWebhookEventRepository)
    private webhookEventRepository: PaymentWebhookEventRepository,
    @inject(TOKENS.OrderRepository)
    private orderRepository: OrderRepository,
    @inject(TOKENS.PaymentProvider)
    private paymentProvider: IPaymentProvider,
  ) {}

  handleWebhook = async (payload: any, signature: string | undefined): Promise<{ message: string; acknowledged: boolean }> => {
    // 1. Verify HMAC signature
    if (!signature || !this.paymentProvider.verifyWebhookSignature(payload, signature)) {
      throw InvalidWebhookSignatureError;
    }

    const event = payload?.event || 'pay';
    const data = payload?.data || payload;

    // 2. Identify event ID for idempotency deduplication
    const eventId = data?.transactionId || data?.kashierOrderId || payload?.eventId || String(Date.now());

    const isNew = await this.webhookEventRepository.tryInsert({
      providerId: KASHIER_PROVIDER_ID,
      providerEventId: eventId,
      signature,
      payload,
    });

    if (!isNew) {
      // Duplicate webhook received: acknowledge with 200 immediately (no side-effects)
      return { message: 'Duplicate webhook acknowledged', acknowledged: true };
    }

    // 3. Locate payment session
    let session = data.kashierOrderId
      ? await this.paymentSessionRepository.findByProviderSessionId(data.kashierOrderId)
      : undefined;

    let order = data.orderReference
      ? await this.orderRepository.findByPublicId(data.orderReference)
      : undefined;

    if (!session && order) {
      session = await this.paymentSessionRepository.findByOrderId(order.id);
    }

    if (!session && !order) {
      await this.webhookEventRepository.markError(eventId, 'Payment session or order not found');
      throw PaymentSessionNotFoundError;
    }

    if (!order && session) {
      order = await this.orderRepository.findById(session.orderId);
    }

    if (!session) {
      await this.webhookEventRepository.markError(eventId, 'Payment session not found');
      throw PaymentSessionNotFoundError;
    }

    // 4. Process event in transaction
    const trx = await db.transaction();
    try {
      if (event === 'pay') {
        if (data.status === 'SUCCESS') {
          await this.paymentSessionRepository.update(
            session.id,
            {
              status: PaymentSessionStatus.CAPTURED,
              rawLastPayload: data,
            },
            trx,
          );

          await this.transactionRepository.create(
            {
              orderId: session.orderId,
              transactionType: TransactionType.CHARGE,
              method: PaymentMethodType.ONLINE,
              providerId: session.providerId,
              providerReferenceId: data.transactionId || null,
              status: TransactionStatus.SUCCEEDED,
              amount: session.amount,
              currency: session.currency,
              srcAccId: order?.customerId || null,
              dstAccId: null,
              isRefunded: false,
              idempotencyKey: data.transactionId ? `charge:${data.transactionId}` : null,
            },
            trx,
          );

          if (order && order.status === OrderStatus.PENDING_PAYMENT) {
            await this.orderRepository.updateStatus(order.publicId, OrderStatus.PLACED, null, trx);
          }
        } else if (data.status === 'FAILURE') {
          const attempts = (session.failureAttempts || 0) + 1;
          const newStatus =
            attempts >= session.maxFailureAttempts
              ? PaymentSessionStatus.FAILED
              : PaymentSessionStatus.PENDING;

          await this.paymentSessionRepository.update(
            session.id,
            {
              status: newStatus,
              failureAttempts: attempts,
              rawLastPayload: data,
            },
            trx,
          );
        }
      } else if (event === 'refund' || event === 'partial_refund') {
        if (data.status === 'SUCCESS') {
          if (data.transactionId) {
            const existingTx = await this.transactionRepository.findByProviderReferenceId(data.transactionId, trx);
            if (existingTx) {
              await this.transactionRepository.updateByProviderRef(
                data.transactionId,
                { status: TransactionStatus.SUCCEEDED },
                trx,
              );
            } else {
              await this.transactionRepository.create(
                {
                  orderId: session.orderId,
                  transactionType: TransactionType.REFUND,
                  method: PaymentMethodType.ONLINE,
                  providerId: session.providerId,
                  providerReferenceId: data.transactionId,
                  status: TransactionStatus.SUCCEEDED,
                  amount: Number(data.amount ? Number(data.amount) * 100 : session.amount),
                  currency: session.currency,
                  srcAccId: null,
                  dstAccId: order?.customerId || null,
                  isRefunded: false,
                  idempotencyKey: `refund:${data.transactionId}`,
                },
                trx,
              );
            }
          }
          if (data.originalTransactionId) {
            await this.transactionRepository.markRefunded(data.originalTransactionId, trx);
          }
        } else if (data.status === 'FAILURE' && data.transactionId) {
          await this.transactionRepository.updateByProviderRef(
            data.transactionId,
            { status: TransactionStatus.FAILED },
            trx,
          );
        }
      } else if (event === 'void') {
        if (data.status === 'SUCCESS') {
          await this.paymentSessionRepository.update(
            session.id,
            {
              status: PaymentSessionStatus.CANCELLED,
              rawLastPayload: data,
            },
            trx,
          );

          if (data.transactionId) {
            await this.transactionRepository.updateByProviderRef(
              data.transactionId,
              { status: TransactionStatus.REVERSED },
              trx,
            );
          }

          if (order && order.status !== OrderStatus.CANCELLED) {
            await this.orderRepository.updateStatus(order.publicId, OrderStatus.CANCELLED, 'cancelled_at', trx);
          }
        }
      }

      await this.webhookEventRepository.markProcessed(eventId, trx);
      await trx.commit();
      return { message: 'Webhook processed successfully', acknowledged: true };
    } catch (err: any) {
      await trx.rollback();
      await this.webhookEventRepository.markError(eventId, err?.message || String(err));
      throw err;
    }
  };
}
