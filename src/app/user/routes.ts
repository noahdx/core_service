import { Router } from 'express';
import { container } from '../../lib/di/container';
import { UserController } from './controller/user.controller';
import { tokens } from '../../lib/di/tokens';

const userController = container.resolve<UserController>(tokens.UserController);

export const userRouter = Router();
userRouter.get('/profile', userController.getProfile);
userRouter.patch('/profile', userController.updateProfile);
