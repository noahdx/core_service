import { Router } from 'express';
import { container } from '../../lib/di/container';
import { AuthController } from './controller/auth.controller';
import { tokens } from '../../lib/di/tokens';

const authController = container.resolve<AuthController>(tokens.AuthController);

export const authRouter = Router();
authRouter.post('/login', authController.login);
authRouter.post('/register', authController.register);
authRouter.post('/forget-password', authController.forgetPassword);
authRouter.post('/reset-password', authController.resetPassword);
