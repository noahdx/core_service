import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { parseFilters, parsePagination } from '../../../lib/http/pagination/parse-query';
import { sendPaginated, sendSuccess } from '../../../lib/http/response';
import { validateBody } from '../../../lib/validation/validate';
import { SystemRole } from '../../user/types';
import { RegisterRestaurantDTO, UpdatedRestaurantDTO, UpdateRestaurantStatusDTO } from '../dto/restaurant-req-.dto';
import { RestaurantService } from '../service/restaurant.service';

@injectable()
export class RestaurantController {
  constructor(@inject(tokens.RestaurantService) private readonly restaurantService: RestaurantService) {}

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.restaurantId);
      const result = await this.restaurantService.getById(id);
      sendSuccess(res, 'Restaurant retrieved successfully', result.data);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    const params = parsePagination(req.query, ['name', 'status', 'createdAt']);
    const filters = parseFilters(req.query, ['id', 'status', 'name']);
    const result = await this.restaurantService.getAll(params, filters);
    sendPaginated(res, result.data, result.meta);
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.role as SystemRole;
      const data = await validateBody(RegisterRestaurantDTO, req.body);
      const result = await this.restaurantService.createWithOwner(role, data);
      sendSuccess(res, 'Owner created successfully', result);
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
      sendSuccess(res, 'Restaurant updated successfully', result.data);
    } catch (err) {
      next(err);
    }
  };
}
