import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { UserService } from '../service/user.service';
import { NextFunction, Request, Response } from 'express';
import { validateBody } from '../../../lib/validation/validate';
import { UpdateUserDTO } from '../dto/user-req.dto';

@injectable()
export class UserController {
  constructor(@inject(tokens.UserService) private readonly userService: UserService) {}

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const result = await this.userService.getProfile(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    const id = Number(req.params.id);
    const data = await validateBody(UpdateUserDTO, req.body);
    const result = await this.userService.update(id, data);
    res.status(200).json(result);
  }
}
