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
import { TransactionEntity } from '../entity/transaction.entity';
import { TransactionStatus, TransactionType } from '../enums';

@injectable()
export class TransactionRepository {
  private readonly COLUMNS = [
    'id',
    'order_id',
    'transaction_type',
    'method',
    'provider_id',
    'provider_reference_id',
    'status',
    'amount',
    'currency',
    'src_acc_id',
    'dst_acc_id',
    'is_refunded',
    'refunded_payment_id',
    'idempotency_key',
    'created_at',
    'updated_at',
  ];

  create = async (data: Partial<TransactionEntity>, trx: Knex = db): Promise<TransactionEntity> => {
    const [row] = await trx('transactions')
      .insert({
        order_id: data.orderId,
        transaction_type: data.transactionType,
        method: data.method,
        provider_id: data.providerId,
        provider_reference_id: data.providerReferenceId,
        status: data.status,
        amount: data.amount,
        currency: data.currency || 'EGP',
        src_acc_id: data.srcAccId,
        dst_acc_id: data.dstAccId,
        is_refunded: data.isRefunded ?? false,
        refunded_payment_id: data.refundedPaymentId,
        idempotency_key: data.idempotencyKey,
        created_at: data.createdAt ?? new Date(),
        updated_at: data.updatedAt ?? new Date(),
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  };

  findById = async (id: number, conn: Knex = db): Promise<TransactionEntity | undefined> => {
    const row = await conn('transactions').where('id', id).select(this.COLUMNS).first();
    return row ? this.toEntity(row) : undefined;
  };

  findByOrderId = async (orderId: number, conn: Knex = db): Promise<TransactionEntity[]> => {
    const rows = await conn('transactions').where('order_id', orderId).select(this.COLUMNS).orderBy('created_at', 'asc');
    return rows.map(this.toEntity);
  };

  findByOrderIds = async (orderIds: number[], conn: Knex = db): Promise<TransactionEntity[]> => {
    if (orderIds.length === 0) return [];
    const rows = await conn('transactions').whereIn('order_id', orderIds).select(this.COLUMNS).orderBy('created_at', 'asc');
    return rows.map(this.toEntity);
  };

  findByProviderReferenceId = async (providerRef: string, conn: Knex = db): Promise<TransactionEntity | undefined> => {
    const row = await conn('transactions').where('provider_reference_id', providerRef).select(this.COLUMNS).first();
    return row ? this.toEntity(row) : undefined;
  };

  updateByProviderRef = async (
    providerRef: string,
    data: Partial<TransactionEntity>,
    trx: Knex = db,
  ): Promise<TransactionEntity | undefined> => {
    const payload: Record<string, any> = {
      updated_at: new Date(),
    };

    if (data.status !== undefined) payload.status = data.status;
    if (data.isRefunded !== undefined) payload.is_refunded = data.isRefunded;
    if (data.refundedPaymentId !== undefined) payload.refunded_payment_id = data.refundedPaymentId;

    const [row] = await trx('transactions').where('provider_reference_id', providerRef).update(payload).returning(this.COLUMNS);

    return row ? this.toEntity(row) : undefined;
  };

  markRefunded = async (providerRef: string, trx: Knex = db): Promise<void> => {
    await trx('transactions').where('provider_reference_id', providerRef).update({ is_refunded: true, updated_at: new Date() });
  };

  sumRefundedByOrderId = async (orderId: number, conn: Knex = db): Promise<number> => {
    const res = await conn('transactions')
      .where({
        order_id: orderId,
        transaction_type: TransactionType.REFUND,
        status: TransactionStatus.SUCCEEDED,
      })
      .sum('amount as total');

    return Number(res[0]?.total || 0);
  };

  findPayoutsByOwnerId = async (
    ownerId: number,
    from?: Date,
    to?: Date,
    pagination?: IPaginationParams,
    extraFilters: IFilterParams[] = [],
    conn: Knex = db,
  ): Promise<{ data: TransactionEntity[]; meta: any }> => {
    let query = conn('transactions')
      .where({
        transaction_type: TransactionType.PAYOUT,
        dst_acc_id: ownerId,
      })
      .select(this.COLUMNS);

    if (from) {
      query = query.where('created_at', '>=', from);
    }
    if (to) {
      query = query.where('created_at', '<=', to);
    }

    applyFilters(query, extraFilters);

    if (pagination) {
      applyCursorPagination(query, pagination);
      const rows = await query;
      const result = buildPaginationResult(rows, pagination.limit, pagination.sortBy || 'createdAt');
      return {
        data: result.data.map(this.toEntity),
        meta: result.meta,
      };
    }

    const rows = await query.orderBy('created_at', 'desc');
    return {
      data: rows.map(this.toEntity),
      meta: { count: rows.length, hasMore: false, nextCursor: null },
    };
  };

  private toEntity = (row: any): TransactionEntity => {
    return new TransactionEntity({
      id: Number(row.id),
      orderId: row.order_id ? Number(row.order_id) : null,
      transactionType: row.transaction_type,
      method: row.method,
      providerId: row.provider_id ? Number(row.provider_id) : null,
      providerReferenceId: row.provider_reference_id,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
      srcAccId: row.src_acc_id ? Number(row.src_acc_id) : null,
      dstAccId: row.dst_acc_id ? Number(row.dst_acc_id) : null,
      isRefunded: Boolean(row.is_refunded),
      refundedPaymentId: row.refunded_payment_id ? Number(row.refunded_payment_id) : null,
      idempotencyKey: row.idempotency_key,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  };
}
