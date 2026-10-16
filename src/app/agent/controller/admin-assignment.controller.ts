import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { validateBody } from '../../../lib/validation/validate';
import { AgentService } from '../service/agent.service';
import { AssignAgentDTO } from '../dto/agent-request.dto';

@injectable()
export class AdminAssignmentController {
  constructor(@inject(tokens.AgentService) private readonly agentService: AgentService) {}

  assign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const publicId = req.params.publicId as string;
      const data = await validateBody(AssignAgentDTO, req.body);
      const result = await this.agentService.adminAssign(publicId, data.agentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
