import { Router } from 'express';
import { container } from '../../lib/di/container';
import { AuthController } from './controller/auth.controller';
import { tokens } from '../../lib/di/tokens';
import { authenticate } from '../../lib/auth/authenticate';

const authController = container.resolve<AuthController>(tokens.AuthController);

export const authRouter = Router();
authRouter.post('/login', authController.login);
authRouter.post('/register', authController.register);
authRouter.post('/forget-password', authController.forgetPassword);
authRouter.post('/reset-password', authController.resetPassword);
authRouter.post('/refresh', authenticate, authController.refresh);
authRouter.post('/accept-invite', authController.acceptInvite);
