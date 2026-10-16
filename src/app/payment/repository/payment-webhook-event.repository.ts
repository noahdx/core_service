import { Knex } from 'knex';
import { injectable } from 'tsyringe';
import { db } from '../../../lib/knex/knex';

export interface IPaymentWebhookEventData {
  providerId: number;
  providerEventId: string;
  signature: string;
  payload: any;
}

@injectable()
export class PaymentWebhookEventRepository {
  private readonly COLUMNS = [
    'id',
    'provider_id',
    'provider_event_id',
    'signature',
    'payload',
    'received_at',
    'processed_at',
    'process_error',
  ];

  tryInsert = async (data: IPaymentWebhookEventData, trx: Knex = db): Promise<boolean> => {
    const rawQuery = `
      INSERT INTO payment_webhook_events (
        provider_id,
        provider_event_id,
        signature,
        payload,
        received_at
      ) VALUES (
        :providerId,
        :providerEventId,
        :signature,
        :payload::jsonb,
        NOW()
      )
      ON CONFLICT (provider_id, provider_event_id) DO NOTHING
      RETURNING id;
    `;

    const result = await trx.raw(rawQuery, {
      providerId: data.providerId,
      providerEventId: data.providerEventId,
      signature: data.signature,
      payload: JSON.stringify(data.payload),
    });

    return (result.rows && result.rows.length > 0) || false;
  };

  markProcessed = async (providerEventId: string, trx: Knex = db): Promise<void> => {
    await trx('payment_webhook_events').where('provider_event_id', providerEventId).update({ processed_at: new Date() });
  };

  markError = async (providerEventId: string, error: string, trx: Knex = db): Promise<void> => {
    await trx('payment_webhook_events').where('provider_event_id', providerEventId).update({ process_error: error });
  };
}
