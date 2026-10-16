import { inject, injectable } from 'tsyringe';
import Redis from 'ioredis';
import { tokens } from '../../../lib/di/tokens';
import { ICacheProvider } from '../../../pkg/cache/cache.interface';
import { OrderRepository } from '../../order/repository/order.repository';
import { UserRepository } from '../../user/repository/user.repository';
import { BranchRepository } from '../../branch/repository/branch.repository';
import { PresenceService } from './presence.service';
import { SystemRole } from '../../user/types';
import { AgentNotFoundError, AgentOfflineError, OfferExpiredError, OrderAlreadyClaimedError } from '../errors';
import { OrderNotFoundError } from '../../order/errors';
import { OrderEntity } from '../../order/entity/order.entity';

@injectable()
export class AssignmentService {
  private redis: Redis;

  constructor(
    @inject(tokens.CacheProvider) private readonly cache: ICacheProvider,
    @inject(tokens.OrderRepository) private readonly orderRepository: OrderRepository,
    @inject(tokens.UserRepository) private readonly userRepository: UserRepository,
    @inject(tokens.BranchRepository) private readonly branchRepository: BranchRepository,
    @inject(tokens.PresenceService) private readonly presenceService: PresenceService,
  ) {
    this.redis = this.cache.getClient ? this.cache.getClient() : (this.cache as any).client;
  }

  claim = async (orderPublicId: string, agentId: number): Promise<OrderEntity> => {
    // 1. Check if agent is online
    const isOnline = await this.presenceService.isOnline(agentId);
    if (!isOnline) {
      throw AgentOfflineError;
    }

    // 2. Atomic claim via Redis SET NX EX
    const claimKey = `claim:order:${orderPublicId}`;
    const acquired = await this.redis.set(claimKey, String(agentId), 'EX', 300, 'NX');
    if (!acquired) {
      throw OrderAlreadyClaimedError;
    }

    // 3. Atomically update order in Postgres if ready and unassigned
    const updatedOrder = await this.orderRepository.claimReadyOrderForAgent(orderPublicId, agentId);
    if (!updatedOrder) {
      await this.redis.del(claimKey);
      throw OrderAlreadyClaimedError;
    }

    // 4. Mark agent as busy in Redis
    await this.presenceService.setBusy(agentId);

    return updatedOrder;
  };

  reject = async (orderPublicId: string, agentId: number): Promise<{ success: boolean }> => {
    const rejectKey = `rejected:order:${orderPublicId}:${agentId}`;
    await this.redis.set(rejectKey, '1', 'EX', 30);
    return { success: true };
  };

  adminAssign = async (orderPublicId: string, agentId: number): Promise<OrderEntity> => {
    // 1. Verify agent user
    const agent = await this.userRepository.findById(agentId);
    if (!agent || agent.systemRole !== SystemRole.DELIVERY_AGENT) {
      throw AgentNotFoundError;
    }

    // 2. Assign order in Postgres
    const order = await this.orderRepository.assignOrderToAgent(orderPublicId, agentId);
    if (!order) {
      throw OrderNotFoundError;
    }

    // 3. Set claim and busy in Redis
    const claimKey = `claim:order:${orderPublicId}`;
    await this.redis.set(claimKey, String(agentId), 'EX', 3600);
    await this.presenceService.setBusy(agentId);

    return order;
  };

  tryBroadcastOffer = async (order: OrderEntity): Promise<number[]> => {
    const branch = await this.branchRepository.findById(order.branchId);
    if (!branch) return [];

    const radius = branch.deliveryRadius || 5000;
    const candidates = await this.presenceService.findNearbyAgents(branch.lat, branch.lng, radius, 5);

    const eligibleAgentIds: number[] = [];
    for (const c of candidates) {
      const isRejected = await this.redis.exists(`rejected:order:${order.publicId}:${c.agentId}`);
      if (isRejected === 0) {
        eligibleAgentIds.push(c.agentId);
      }
    }

    if (eligibleAgentIds.length > 0) {
      const offerKey = `offer:order:${order.publicId}`;
      await this.redis.set(offerKey, JSON.stringify(eligibleAgentIds), 'EX', 30);
    }

    return eligibleAgentIds;
  };
}
