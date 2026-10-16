import { inject, injectable } from 'tsyringe';
import { Knex } from 'knex';
import { tokens } from '../../../lib/di/tokens';
import { OrderEntity } from '../../order/entity/order.entity';
import { RestaurantBalanceRepository } from '../repository/restaurant-balance.repository';
import { AgentEarningRepository } from '../repository/agent-earning.repository';
import { PresenceService } from './presence.service';
import { AgentEarningEntity } from '../entity/agent-earning.entity';
import { RestaurantBalanceEntity } from '../entity/restaurant-balance.entity';

@injectable()
export class SettlementService {
  constructor(
    @inject(tokens.RestaurantBalanceRepository)
    private readonly balanceRepository: RestaurantBalanceRepository,
    @inject(tokens.AgentEarningRepository)
    private readonly earningRepository: AgentEarningRepository,
    @inject(tokens.PresenceService)
    private readonly presenceService: PresenceService,
  ) {}

  settleOrder = async (
    order: OrderEntity,
    trx: Knex,
  ): Promise<{ balance: RestaurantBalanceEntity; earning?: AgentEarningEntity }> => {
    // 1. Restaurant balance update: subtotal - commission
    const netRestaurantAmount = order.subtotal - order.commission;
    const balance = await this.balanceRepository.upsertIncrement(
      order.restaurantId,
      netRestaurantAmount,
      trx,
    );

    let earning: AgentEarningEntity | undefined;

    // 2. If delivery agent assigned, record agent earning (deliveryFee)
    if (order.agentId) {
      earning = await this.earningRepository.insert(
        {
          agentId: order.agentId,
          orderId: order.id,
          amount: order.deliveryFee,
          currency: 'EGP',
        },
        trx,
      );

      // 3. Clear agent from busy set
      await this.presenceService.clearBusy(order.agentId);
    }

    return { balance, earning };
  };
}
