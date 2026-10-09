import { NextFunction, Request, Response, Router } from 'express';
import { pingDB } from '../../lib/knex/knex';

export const healthRouter = Router();
healthRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pingDB();
  } catch (error) {
    next(error);
  }
});
