import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { rbac, requireRestaurantMember } from '../../lib/auth/rbac';
import { container } from '../../lib/di/container';
import { tokens } from '../../lib/di/tokens';
import { idempotency } from '../../lib/idempotency/idempotency';
import { FinanceController } from './controller/finance.controller';

export const financeRouter = Router();

const financeController = container.resolve<FinanceController>(tokens.FinanceController);

// 1. Restaurant Finance (Owner and Branch Manager with core:finance:read)
financeRouter.get(
  '/restaurants/:restaurantId/balance',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:finance', action: 'read' }),
  financeController.getBalance,
);

financeRouter.get(
  '/restaurants/:restaurantId/payouts',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:finance', action: 'read' }),
  financeController.listPayouts,
);

// 2. Admin Payout Recording
financeRouter.post(
  '/admin/restaurants/:restaurantId/payouts',
  authenticate,
  idempotency({ strict: true }),
  financeController.recordPayout,
);
