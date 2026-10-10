import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { tokens } from '../../lib/di/tokens';
import { container } from '../../lib/di/container';
import { RestaurantController } from './controller/restaurant.controller';

export const restaurantRouter = Router();

const restaurantController = container.resolve<RestaurantController>(tokens.RestaurantController);

restaurantRouter.get('/:id', restaurantController.getById);
restaurantRouter.post('/', authenticate, restaurantController.create); // system_admin only, checked in service
restaurantRouter.patch('/:id', authenticate, restaurantController.update);
restaurantRouter.patch('/:id/status', authenticate, restaurantController.updateStatus); // system_admin only, checked in service
