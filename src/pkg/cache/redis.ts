import { ICacheProvider } from './cache.interface';
import Redis from 'ioredis';
import { logger } from '../../lib/logger/logger';

interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
}

export class RedisCacheProvider implements ICacheProvider {
  private client: Redis;

  constructor(config: IRedisConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (error) => {
      logger.error(`Redis Error: ${error.message}`);
    });

    this.client.connect().catch((error) => {
      logger.error(`Redis Connect Error: ${error.message}`);
    });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } else {
      await this.client.set(key, JSON.stringify(value));
    }
  }

  async get(key: string): Promise<any> {
    return await this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
