import { injectable } from 'tsyringe';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';
import { AgentEarningEntity } from '../entity/agent-earning.entity';
import {
  applyCursorPagination,
  applyFilters,
  buildPaginationResult,
  IFilterParams,
  IPaginationMeta,
  IPaginationParams,
} from '../../../lib/http/pagination/cursor-pagination';

export interface IListAgentEarningsResult {
  data: AgentEarningEntity[];
  meta: IPaginationMeta;
}

@injectable()
export class AgentEarningRepository {
  private static COLUMNS = ['id', 'agent_id', 'order_id', 'amount', 'currency', 'earned_at'];

  insert = async (
    earning: { agentId: number; orderId: number; amount: number; currency?: string },
    trx: Knex = db,
  ): Promise<AgentEarningEntity> => {
    const [row] = await trx('agent_earnings')
      .insert({
        agent_id: earning.agentId,
        order_id: earning.orderId,
        amount: earning.amount,
        currency: earning.currency || 'EGP',
        earned_at: new Date(),
      })
      .returning(AgentEarningRepository.COLUMNS);

    return this.toEntity(row);
  };

  findByOrder = async (orderId: number, conn: Knex = db): Promise<AgentEarningEntity | undefined> => {
    const row = await conn('agent_earnings').where('order_id', orderId).select(AgentEarningRepository.COLUMNS).first();

    return row ? this.toEntity(row) : undefined;
  };

  listByAgent = async (
    agentId: number,
    pagination: IPaginationParams,
    extraFilters: IFilterParams[] = [],
    from?: Date,
    to?: Date,
    conn: Knex = db,
  ): Promise<IListAgentEarningsResult> => {
    let query = conn('agent_earnings').where('agent_id', agentId).select(AgentEarningRepository.COLUMNS);

    if (from) {
      query = query.where('earned_at', '>=', from);
    }

    if (to) {
      query = query.where('earned_at', '<=', to);
    }

    const paginationParams: IPaginationParams = {
      ...pagination,
      orderBy: pagination.orderBy === 'createdAt' ? 'earnedAt' : pagination.orderBy,
    };

    applyFilters(query, extraFilters);
    applyCursorPagination(query, paginationParams);
    const rows = await query;
    const result = buildPaginationResult(rows, pagination.limit, paginationParams.orderBy || 'earnedAt');

    return {
      data: result.data.map(this.toEntity),
      meta: result.meta,
    };
  };

  sumByAgent = async (agentId: number, from?: Date, to?: Date, conn: Knex = db): Promise<{ total: number; count: number }> => {
    let query = conn('agent_earnings').where('agent_id', agentId);

    if (from) {
      query = query.where('earned_at', '>=', from);
    }

    if (to) {
      query = query.where('earned_at', '<=', to);
    }

    const row = await query.sum('amount as total').count('id as count').first();

    return {
      total: Number(row?.total ?? 0),
      count: Number(row?.count ?? 0),
    };
  };

  private toEntity = (row: any): AgentEarningEntity => {
    return new AgentEarningEntity({
      id: Number(row.id),
      agentId: Number(row.agent_id),
      orderId: Number(row.order_id),
      amount: Number(row.amount),
      currency: row.currency,
      earnedAt: row.earned_at,
    });
  };
}
