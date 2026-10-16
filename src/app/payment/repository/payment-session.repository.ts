import { Knex } from 'knex';
import { injectable } from 'tsyringe';
import {
  applyCursorPagination,
  applyFilters,
  buildPaginationResult,
  IFilterParams,
  IPaginationParams,
} from '../../../lib/http/pagination/cursor-pagination';
import { db } from '../../../lib/knex/knex';
import { PaymentSessionEntity } from '../entity/payment-session.entity';
import { IListPaymentsResult, IListRestaurantPaymentsFilter } from '../types';

@injectable()
export class PaymentSessionRepository {
  private readonly COLUMNS = [
    'id',
    'order_id',
    'provider_id',
    'provider_session_id',
    'redirect_url',
    'amount',
    'currency',
    'status',
    'raw_init_payload',
    'raw_last_payload',
    'failure_attempts',
    'max_failure_attempts',
    'created_at',
    'updated_at',
  ];

  create = async (data: Partial<PaymentSessionEntity>, trx: Knex = db): Promise<PaymentSessionEntity> => {
    const [row] = await trx('payment_sessions')
      .insert({
        order_id: data.orderId,
        provider_id: data.providerId,
        provider_session_id: data.providerSessionId,
        redirect_url: data.redirectUrl,
        amount: data.amount,
        currency: data.currency || 'EGP',
        status: data.status,
        raw_init_payload: data.rawInitPayload ? JSON.stringify(data.rawInitPayload) : null,
        raw_last_payload: data.rawLastPayload ? JSON.stringify(data.rawLastPayload) : null,
        failure_attempts: data.failureAttempts ?? 0,
        max_failure_attempts: data.maxFailureAttempts ?? 3,
        created_at: data.createdAt ?? new Date(),
        updated_at: data.updatedAt ?? new Date(),
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  };

  findById = async (id: number, conn: Knex = db): Promise<PaymentSessionEntity | undefined> => {
    const row = await conn('payment_sessions').where('id', id).select(this.COLUMNS).first();
    return row ? this.toEntity(row) : undefined;
  };

  findByOrderId = async (orderId: number, conn: Knex = db): Promise<PaymentSessionEntity | undefined> => {
    const row = await conn('payment_sessions').where('order_id', orderId).select(this.COLUMNS).first();
    return row ? this.toEntity(row) : undefined;
  };

  findByProviderSessionId = async (providerSessionId: string, conn: Knex = db): Promise<PaymentSessionEntity | undefined> => {
    const row = await conn('payment_sessions').where('provider_session_id', providerSessionId).select(this.COLUMNS).first();
    return row ? this.toEntity(row) : undefined;
  };

  update = async (id: number, data: Partial<PaymentSessionEntity>, trx: Knex = db): Promise<PaymentSessionEntity> => {
    const payload: Record<string, any> = {
      updated_at: new Date(),
    };

    if (data.status !== undefined) payload.status = data.status;
    if (data.redirectUrl !== undefined) payload.redirect_url = data.redirectUrl;
    if (data.amount !== undefined) payload.amount = data.amount;
    if (data.rawInitPayload !== undefined) payload.raw_init_payload = JSON.stringify(data.rawInitPayload);
    if (data.rawLastPayload !== undefined) payload.raw_last_payload = JSON.stringify(data.rawLastPayload);
    if (data.failureAttempts !== undefined) payload.failure_attempts = data.failureAttempts;
    if (data.maxFailureAttempts !== undefined) payload.max_failure_attempts = data.maxFailureAttempts;

    const [row] = await trx('payment_sessions').where('id', id).update(payload).returning(this.COLUMNS);
    return this.toEntity(row);
  };

  findByRestaurant = async (
    filter: IListRestaurantPaymentsFilter,
    pagination: IPaginationParams,
    extraFilters: IFilterParams[] = [],
    conn: Knex = db,
  ): Promise<IListPaymentsResult> => {
    const query = conn('payment_sessions')
      .join('orders', 'payment_sessions.order_id', 'orders.id')
      .where('orders.restaurant_id', filter.restaurantId)
      .select(this.COLUMNS.map((col) => `payment_sessions.${col}`));

    if (filter.status) {
      query.where('payment_sessions.status', filter.status);
    }
    if (filter.from) {
      query.where('payment_sessions.created_at', '>=', filter.from);
    }
    if (filter.to) {
      query.where('payment_sessions.created_at', '<=', filter.to);
    }

    applyFilters(query, extraFilters);
    applyCursorPagination(query, pagination);
    const rows = await query;
    const result = buildPaginationResult(rows, pagination.limit, pagination.sortBy || 'createdAt');

    return {
      data: result.data.map(this.toEntity),
      meta: result.meta,
    };
  };

  private toEntity = (row: any): PaymentSessionEntity => {
    return new PaymentSessionEntity({
      id: Number(row.id),
      orderId: Number(row.order_id),
      providerId: Number(row.provider_id),
      providerSessionId: row.provider_session_id,
      redirectUrl: row.redirect_url,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      rawInitPayload: typeof row.raw_init_payload === 'string' ? JSON.parse(row.raw_init_payload) : row.raw_init_payload,
      rawLastPayload: typeof row.raw_last_payload === 'string' ? JSON.parse(row.raw_last_payload) : row.raw_last_payload,
      failureAttempts: Number(row.failure_attempts),
      maxFailureAttempts: Number(row.max_failure_attempts),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  };
}
