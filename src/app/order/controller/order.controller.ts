import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { parseFilters, parsePagination } from '../../../lib/http/pagination/parse-query';
import { validateBody } from '../../../lib/validation/validate';
import { CreateOrderDTO, UpdateOrderStatusDTO } from '../dto/order-req.dto';
import { OrderService } from '../service/order.service';
import { OrderStatus } from '../types';

@injectable()
export class OrderController {
  constructor(@inject(tokens.OrderService) private readonly orderService: OrderService) {}

  placeOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = Number(req.user?.userId);
      const data = await validateBody(CreateOrderDTO, req.body);
      const result = await this.orderService.placeOrder(customerId, data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const publicId = req.params.publicId as string;
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role!;
      const result = await this.orderService.getOrderByPublicId(publicId, userId, userRole);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const publicId = req.params.publicId as string;
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role!;
      const data = await validateBody(UpdateOrderStatusDTO, req.body);
      const result = await this.orderService.updateStatus(publicId, userId, userRole, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  listCustomerOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = Number(req.user?.userId);
      const pagination = parsePagination(req.query, ['createdAt', 'id']);
      const filters = parseFilters(req.query, ['status', 'paymentMethod']);
      const year = req.query.year ? Number(req.query.year) : undefined;
      const result = await this.orderService.listCustomerOrders(customerId, pagination, filters, year);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  listBranchOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = Number(req.params.branchId);
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role!;
      const status = req.query.status as OrderStatus | undefined;
      const pagination = parsePagination(req.query, ['createdAt', 'id']);
      const filters = parseFilters(req.query, ['status', 'paymentMethod']);
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;
      const result = await this.orderService.listBranchOrders(branchId, userId, userRole, pagination, filters, status, from, to);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  releaseAssignedOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const result = await this.orderService.releaseAssignedOrders(agentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
