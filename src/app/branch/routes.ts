import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { container } from '../../lib/di/container';
import { BranchController } from './controller/branch.controller';
import { tokens } from '../../lib/di/tokens';
import { rbac, requireBranchAccess } from '../../lib/auth/rbac';
import { cacheLayer } from '../../lib/cache/cache-layer';

export const branchRouter = Router();

const branchController = container.resolve<BranchController>(tokens.BranchController);

branchRouter.get('/branches/nearby', branchController.getNearBranches);
branchRouter.get('/restaurants/:restaurantId/branches', cacheLayer({ restaurantScoped: true }), branchController.getByRestaurant);

branchRouter.post('/restaurants/:restaurantId/branches', authenticate, branchController.create);
branchRouter.patch(
  '/branches/:branchId',
  authenticate,
  requireBranchAccess('branchId'),
  rbac({ resource: 'core:branch', action: 'update' }),
  branchController.update,
);
branchRouter.patch('/branches/:branchId/status', authenticate, branchController.updateStatus); // system_admin only, checked in service

// Internal (service-to-service)
// branchRouter.get('/internal/branches/:branchId', branchController.findByIdWithRestaurant);
