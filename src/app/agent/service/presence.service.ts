import { inject, injectable } from 'tsyringe';
import Redis from 'ioredis';
import { tokens } from '../../../lib/di/tokens';
import { ICacheProvider } from '../../../pkg/cache/cache.interface';
import { OrderRepository } from '../../order/repository/order.repository';
import { OrderService } from '../../order/service/order.service';
import { CannotGoOfflineWithPickedOrder } from '../errors';
import { IAgentCandidate, IAgentLocation, IAgentPresenceMeta } from '../types';

@injectable()
export class PresenceService {
  private redis: Redis;

  constructor(
    @inject(tokens.CacheProvider) private readonly cache: ICacheProvider,
    @inject(tokens.OrderRepository) private readonly orderRepository: OrderRepository,
    @inject(tokens.OrderService) private readonly orderService: OrderService,
  ) {
    this.redis = this.cache.getClient ? this.cache.getClient() : (this.cache as any).client;
  }

  goOnline = async (agentId: number, lat: number, lng: number): Promise<{ ttl: number }> => {
    const metaKey = `presence:meta:${agentId}`;
    const now = Date.now();

    await this.redis
      .pipeline()
      .hset(metaKey, {
        lat: String(lat),
        lng: String(lng),
        lastSeenAt: String(now),
      })
      .expire(metaKey, 300)
      .geoadd('presence:geo', lng, lat, String(agentId))
      .exec();

    return { ttl: 300 };
  };

  ping = async (agentId: number, lat: number, lng: number): Promise<void> => {
    const metaKey = `presence:meta:${agentId}`;
    const now = Date.now();

    await this.redis
      .pipeline()
      .hset(metaKey, {
        lat: String(lat),
        lng: String(lng),
        lastSeenAt: String(now),
      })
      .expire(metaKey, 300)
      .geoadd('presence:geo', lng, lat, String(agentId))
      .exec();
  };

  goOffline = async (agentId: number): Promise<void> => {
    // 1. Check if agent has active picked orders
    const hasPicked = await this.orderRepository.hasPickedOrders(agentId);
    if (hasPicked) {
      throw CannotGoOfflineWithPickedOrder;
    }

    // 2. Release assigned orders back to ready
    await this.orderService.releaseAssignedOrders(agentId);

    // 3. Clear Redis presence keys
    const metaKey = `presence:meta:${agentId}`;
    await this.redis
      .pipeline()
      .del(metaKey)
      .zrem('presence:geo', String(agentId))
      .srem('presence:busy', String(agentId))
      .exec();
  };

  isOnline = async (agentId: number): Promise<boolean> => {
    const exists = await this.redis.exists(`presence:meta:${agentId}`);
    return exists === 1;
  };

  isBusy = async (agentId: number): Promise<boolean> => {
    const isBusy = await this.redis.sismember('presence:busy', String(agentId));
    return isBusy === 1;
  };

  setBusy = async (agentId: number): Promise<void> => {
    await this.redis.sadd('presence:busy', String(agentId));
  };

  clearBusy = async (agentId: number): Promise<void> => {
    await this.redis.srem('presence:busy', String(agentId));
  };

  getLocation = async (agentId: number): Promise<IAgentLocation | null> => {
    const meta = await this.redis.hgetall(`presence:meta:${agentId}`);
    if (!meta || !meta.lat || !meta.lng) return null;
    return {
      lat: Number(meta.lat),
      lng: Number(meta.lng),
    };
  };

  findNearbyAgents = async (
    lat: number,
    lng: number,
    radiusMeters: number = 5000,
    limit: number = 5,
  ): Promise<IAgentCandidate[]> => {
    // GEORADIUS presence:geo lng lat radius m WITHDIST ASC
    const results = (await this.redis.georadius(
      'presence:geo',
      lng,
      lat,
      radiusMeters,
      'm',
      'WITHDIST',
      'ASC',
    )) as [string, string][];

    if (!results || results.length === 0) return [];

    const candidates: IAgentCandidate[] = [];
    for (const [idStr, distStr] of results) {
      const agentId = Number(idStr);
      // check if busy
      const busy = await this.isBusy(agentId);
      if (busy) continue;

      // check if meta exists
      const online = await this.isOnline(agentId);
      if (!online) {
        // stale geo entry
        await this.redis.zrem('presence:geo', idStr);
        continue;
      }

      candidates.push({
        agentId,
        distance: Number(distStr),
      });

      if (candidates.length >= limit) break;
    }

    return candidates;
  };
}
