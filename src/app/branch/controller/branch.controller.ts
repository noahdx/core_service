import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { BranchService } from '../service/branch.service';
import { NextFunction, Request, Response } from 'express';
import { CreateBranchDTO, UpdateBranchDTO, UpdateBranchStatusDTO } from '../dto/branch-req.dto';
import { validateBody } from '../../../lib/validation/validate';
import { SystemRole } from '../../user/types';

@injectable()
export class BranchController {
  constructor(@inject(tokens.BranchService) private readonly branchService: BranchService) {}

  getNearBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lng = Number(req.query.lng);
      const lat = Number(req.query.lat);
      const result = await this.branchService.getNearBranches(lng, lat);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getByRestaurant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const result = await this.branchService.getByRestaurant(restaurantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  findByIdWithRestaurant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = Number(req.params.branchId);
      const result = await this.branchService.findByIdWithRestaurant(branchId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = Number(req.user?.userId);
      const role = req.user?.role as SystemRole;
      const restaurantId = Number(req.params.restaurantId);
      const data = await validateBody(CreateBranchDTO, req.body);
      const result = await this.branchService.create(userId, role, restaurantId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = Number(req.user?.userId!);
      const branchId = Number(req.params.branchId);
      const role = req.user?.role! as SystemRole;
      const data = await validateBody(UpdateBranchDTO, req.body);
      const result = await this.branchService.update(userId, role, branchId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = Number(req.params.branchId);
      const role = req.user?.role! as SystemRole;
      const data = await validateBody(UpdateBranchStatusDTO, req.body);
      const result = await this.branchService.updateStatus(role, branchId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
