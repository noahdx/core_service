import { NextFunction, Request, Response } from 'express';
import { container } from '../../lib/di/container';
import { tokens } from '../di/tokens';
import { ICacheProvider } from '../../pkg/cache/cache.interface';

interface ICacheOptions {
  ttl?: number;
  userScoped?: boolean;
  branchScoped?: boolean;
  restaurantScoped?: boolean;
}

export function cacheLayer({
  ttl = 3600,
  userScoped = false,
  branchScoped = false,
  restaurantScoped = false,
}: ICacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cacheProvider: ICacheProvider = container.resolve(tokens.CacheProvider);

      let key = `${req.method}:${req.originalUrl}`;

      if (userScoped) {
        key = `${key}:${req.user?.userId}`;
      }

      if (branchScoped) {
        key = `${key}:${req.params.branchId}`;
      }

      if (restaurantScoped) {
        key = `${key}:${req.params.restaurantId}`;
      }

      const cached = await cacheProvider.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(JSON.parse(cached));
      }

      const originalJson = res.json.bind(res);

      res.json = (body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheProvider.set(key, JSON.stringify(body), ttl);
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
