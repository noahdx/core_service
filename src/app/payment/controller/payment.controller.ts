import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { parseFilters, parsePagination } from '../../../lib/http/pagination/parse-query';
import { validateBody } from '../../../lib/validation/validate';
import { InitPaymentDTO, RefundRequestDTO } from '../dto/payment-req.dto';
import { PaymentSessionStatus } from '../enums';
import { PaymentService } from '../service/payment.service';

@injectable()
export class PaymentController {
  constructor(
    @inject(tokens.PaymentService)
    private readonly paymentService: PaymentService,
  ) {}

  initPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const branchId = Number(req.params.branchId);
      const orderId = req.params.orderId as string;
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role || '';
      const data = await validateBody(InitPaymentDTO, req.body);

      const result = await this.paymentService.initPayment(
        restaurantId,
        branchId,
        orderId,
        data,
        userId,
        userRole,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const branchId = Number(req.params.branchId);
      const orderId = req.params.orderId as string;
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role || '';

      const result = await this.paymentService.getPaymentByOrder(
        restaurantId,
        branchId,
        orderId,
        userId,
        userRole,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  requestRefund = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paymentId = Number(req.params.paymentId);
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role || '';
      const data = await validateBody(RefundRequestDTO, req.body);

      const result = await this.paymentService.requestRefund(paymentId, data, userId, userRole);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  listPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const userId = Number(req.user?.userId);
      const userRole = req.user?.role || '';

      const pagination = parsePagination(req.query, ['createdAt', 'id']);
      const status = req.query.status as PaymentSessionStatus | undefined;
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const result = await this.paymentService.listPaymentsByRestaurant(
        restaurantId,
        { restaurantId, status, from, to },
        pagination,
        userId,
        userRole,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
