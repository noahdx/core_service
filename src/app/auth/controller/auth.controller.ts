import { inject, injectable } from 'tsyringe';
import { AuthService } from '../service/auth.service';
import { tokens } from '../../../lib/di/tokens';
import { NextFunction, Request, Response } from 'express';
import { validateBody } from '../../../lib/validation/validate';
import { ForgetPasswordDTO, LoginDTO, RegisterDTO, ResetPasswordDTO } from '../dto/auth-req.dto';
import { setCookie } from '../../../lib/utils/cookie';
import { env } from '../../../lib/config/env';
import { toMs } from '../../../pkg/utils/time';

@injectable()
export class AuthController {
  constructor(@inject(tokens.AuthService) private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await validateBody(RegisterDTO, req.body);
      const result = await this.authService.register(data);
      setCookie(res, result.accessToken, result.refreshToken);
      res.status(200).json({});
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await validateBody(LoginDTO, req.body);
      const result = await this.authService.login(data);
      setCookie(res, result.accessToken, result.refreshToken);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  forgetPassword = async (req: Request, res: Response, next: NextFunction) => {
    const data = await validateBody(ForgetPasswordDTO, req.body);
    const result = await this.authService.forgetPassword(data);
    res.status(200).json(result);
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    const data = await validateBody(ResetPasswordDTO, req.body);
    const result = await this.authService.resetPassword(data);
    res.status(200).json(result);
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    const result = await this.authService.refresh(req.cookies.refresh_token);
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: env.isProduction,
      maxAge: toMs(1, 'h'),
    });

    res.status(200).json({ message: 'Success' });
  };
}
