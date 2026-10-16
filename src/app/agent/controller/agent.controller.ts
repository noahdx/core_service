import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { validateBody } from '../../../lib/validation/validate';
import { parseFilters, parsePagination } from '../../../lib/http/pagination/parse-query';
import { AgentService } from '../service/agent.service';
import { AgentStatusDTO, PresenceOnlineDTO, PresencePingDTO } from '../dto/agent-request.dto';

@injectable()
export class AgentController {
  constructor(@inject(tokens.AgentService) private readonly agentService: AgentService) {}

  goOnline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const data = await validateBody(PresenceOnlineDTO, req.body);
      const result = await this.agentService.goOnline(agentId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  ping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const data = await validateBody(PresencePingDTO, req.body);
      const result = await this.agentService.ping(agentId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  goOffline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const result = await this.agentService.goOffline(agentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  accept = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const publicId = req.params.publicId as string;
      const result = await this.agentService.accept(publicId, agentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const publicId = req.params.publicId as string;
      const result = await this.agentService.reject(publicId, agentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const publicId = req.params.publicId as string;
      const data = await validateBody(AgentStatusDTO, req.body);
      const result = await this.agentService.transitionStatus(publicId, agentId, data.status);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const pagination = parsePagination(req.query, ['assignedAt', 'createdAt', 'id']);
      const filters = parseFilters(req.query, ['status']);
      const statusParam = req.query.status as string | undefined;
      const statuses = statusParam ? statusParam.split(',').map((s) => s.trim()) : undefined;

      const result = await this.agentService.getTasks(agentId, pagination, filters, statuses);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getEarnings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const pagination = parsePagination(req.query, ['earnedAt', 'id']);
      const filters = parseFilters(req.query, ['currency']);
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const result = await this.agentService.getEarnings(agentId, pagination, filters, from, to);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getEarningsSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = Number(req.user?.userId);
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const result = await this.agentService.getEarningsSummary(agentId, from, to);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
