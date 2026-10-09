import { Router } from 'express';
import { container } from '../../lib/di/container';
import { UserController } from './controller/user.controller';
import { tokens } from '../../lib/di/tokens';
import { authenticate } from '../../lib/auth/authenticate';

const userController = container.resolve<UserController>(tokens.UserController);

export const userRouter = Router();
userRouter.get('/:id', authenticate, userController.getProfile);
userRouter.patch('/:id', authenticate, userController.updateProfile);
