import { NextFunction, Request, Response, Router } from 'express';
import { pingDB } from '../../lib/knex/knex';

export const healthRouter = Router();
healthRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pingDB();
    res.status(200).json({
      message: 'Service is healthy',
      data: {
        status: 'UP',
        db: 'CONNECTED',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});
