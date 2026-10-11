import { inject, injectable } from 'tsyringe';
import { RestaurantService } from '../service/restaurant.service';
import { NextFunction, Request, Response } from 'express';
import { validateBody } from '../../../lib/validation/validate';
import { RegisterRestaurantDTO, UpdatedRestaurantDTO, UpdateRestaurantStatusDTO } from '../dto/restaurant-req-.dto';
import { SystemRole } from '../../user/types';
import { tokens } from '../../../lib/di/tokens';

@injectable()
export class RestaurantController {
  constructor(@inject(tokens.RestaurantService) private readonly restaurantService: RestaurantService) {}

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.restaurantId);
      const result = await this.restaurantService.getById(id);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.role as SystemRole;
      const data = await validateBody(RegisterRestaurantDTO, req.body);
      const result = await this.restaurantService.createWithOwner(role, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.restaurantId);
      const userId = Number(req.user?.userId);
      const data = await validateBody(UpdatedRestaurantDTO, req.body);
      const result = await this.restaurantService.update(userId, id, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.restaurantId);
      const role = req.user?.role as SystemRole;
      const data = await validateBody(UpdateRestaurantStatusDTO, req.body);
      const result = await this.restaurantService.updateStatus(role, id, data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
