import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { UnAuthorizedError } from '../../../lib/auth/errors';
import { parseFilters, parsePagination } from '../../../lib/http/pagination/parse-query';
import { validateBody } from '../../../lib/validation/validate';
import { SystemRole } from '../../user/types';
import { CreatePayoutRequestDTO } from '../dto/finance-req.dto';
import { FinanceService } from '../service/finance.service';

@injectable()
export class FinanceController {
  constructor(@inject(tokens.FinanceService) private readonly financeService: FinanceService) {}

  getBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const result = await this.financeService.getBalance(restaurantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  listPayouts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const pagination = parsePagination(req.query, ['createdAt', 'id']);
      const filters = parseFilters(req.query, ['status', 'currency']);
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const result = await this.financeService.listPayouts(restaurantId, from, to, pagination, filters);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  recordPayout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== SystemRole.SYSTEM_ADMIN) {
        throw UnAuthorizedError;
      }

      const restaurantId = Number(req.params.restaurantId);
      const data = await validateBody(CreatePayoutRequestDTO, req.body);
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      const result = await this.financeService.recordPayout(restaurantId, data, idempotencyKey);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
