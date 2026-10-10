import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';

import { validateBody } from '../../../lib/validation/validate';
import { SystemRole } from '../../user/types';
import { CreateProductDTO, UpdateProductDTO } from '../dto/product-req.dto';
import { ProductService } from '../service/product.service';
import { tokens } from '../../../lib/di/tokens';

@injectable()
export class ProductController {
  constructor(@inject(tokens.ProductService) private readonly productService: ProductService) {}

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = Number(req.params.id);
      const product = await this.productService.findById(productId);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  };

  findByBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = Number(req.params.branchId);
      const results = await this.productService.findByBranch(branchId);
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  };

  findByRestaurant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const userId = req.user?.userId!;
      const role = req.user?.role! as SystemRole;
      const result = await this.productService.findByRestaurant(restaurantId, userId, role);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  findCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const result = await this.productService.findCategories(restaurantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const userId = req.user?.userId!;
      const role = req.user?.role! as SystemRole;
      const data = await validateBody(CreateProductDTO, req.body);
      const result = await this.productService.create(restaurantId, userId, role, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await validateBody(UpdateProductDTO, req.body);
      const productId = Number(req.params.id);
      const userId = req.user?.userId!;
      const role = req.user?.role! as SystemRole;
      const branchId = Number(req.query.branchId) ? Number(req.query.branchId) : undefined;
      const result = await this.productService.update(role, userId, productId, data, branchId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
