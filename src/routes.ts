import { Router } from 'express';
import { healthRouter } from './app/health/health.route';
import { userRouter } from './app/user/routes';
import { authRouter } from './app/auth/routes';
import { addressRouter } from './app/customer-address/routes';
import { restaurantRouter } from './app/restaurant/routes';
import { branchRouter } from './app/branch/routes';
import { productRouter } from './app/product/routes';

export const routes = Router();
routes.use('/health', healthRouter);
routes.use('/user', userRouter);
routes.use('/auth', authRouter);
routes.use('/address', addressRouter);
routes.use('/restaurant', restaurantRouter);
routes.use('/', branchRouter);
routes.use('/', productRouter);
