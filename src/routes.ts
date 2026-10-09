import { Router } from 'express';
import { healthRouter } from './app/health/health.route';
import { userRouter } from './app/user/routes';
import { authRouter } from './app/auth/routes';

export const routes = Router();
routes.use('/health', healthRouter);
routes.use('/user', userRouter);
routes.use('/auth', authRouter);
