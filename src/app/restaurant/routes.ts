import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { rbac, requireRestaurantMember } from '../../lib/auth/rbac';
import { container } from '../../lib/di/container';
import { tokens } from '../../lib/di/tokens';
import { RestaurantController } from './controller/restaurant.controller';

export const restaurantRouter = Router();

const restaurantController = container.resolve<RestaurantController>(tokens.RestaurantController);

restaurantRouter.get('/', restaurantController.getAll);
restaurantRouter.get('/:restaurantId', restaurantController.getById);
restaurantRouter.post('/', authenticate, restaurantController.create); // system_admin only, checked in service
restaurantRouter.patch(
  '/:restaurantId',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:restaurant', action: 'update' }),
  restaurantController.update,
);

restaurantRouter.patch('/:restaurantId/status', authenticate, restaurantController.updateStatus); // system_admin only, checked in service
