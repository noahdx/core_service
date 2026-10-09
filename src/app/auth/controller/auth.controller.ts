import { inject, injectable } from 'tsyringe';
import { AuthService } from '../service/auth.service';
import { tokens } from '../../../lib/di/tokens';
import { NextFunction, Request, Response } from 'express';
import { validateBody } from '../../../lib/validation/validate';
import { LoginDTO, RegisterDTO } from '../dto/auth-req.dto';

@injectable()
export class AuthController {
  constructor(@inject(tokens.AuthService) private readonly authService: AuthService) {}

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await validateBody(RegisterDTO, req.body);
      const result = await this.authService.register(data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await validateBody(LoginDTO, req.body);
      const result = await this.authService.login(data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
