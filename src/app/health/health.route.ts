import { NextFunction, Request, Response, Router } from 'express';
import { pingDB } from '../../lib/knex/knex';

export const healthRouter = Router();
healthRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pingDB();
    res.status(200).send('OK');
  } catch (error) {
    next(error);
  }
});
