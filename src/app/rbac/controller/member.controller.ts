import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';

import { validateBody } from '../../../lib/validation/validate';
import { CreateMemberDTO, UpdateMemberBranchesDTO, UpdateMemberDTO } from '../dto/member-req.dto';
import { MemberService } from '../service/member.service';
import { tokens } from '../../../lib/di/tokens';
import { RoleQueryRequiredError } from '../errors';

@injectable()
export class MemberController {
  constructor(@inject(tokens.MemberService) private readonly memberService: MemberService) {}

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const result = await this.memberService.listMembers(restaurantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleName = String(req.params.role ?? '');
      if (!roleName) {
        throw RoleQueryRequiredError;
      }

      const result = await this.memberService.getRolePermissions(roleName);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getPermissionsByRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = String(req.query.role ?? '');
      const result = await this.memberService.getPermissionsByRole(role);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  createMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const data = await validateBody(CreateMemberDTO, req.body);
      const result = await this.memberService.create(restaurantId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const memberId = Number(req.params.memberId);
      const data = await validateBody(UpdateMemberDTO, req.body);
      const result = await this.memberService.update(restaurantId, memberId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateMemberBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const memberId = Number(req.params.memberId);
      const data = await validateBody(UpdateMemberBranchesDTO, req.body);
      const result = await this.memberService.updateMemberBranches(restaurantId, memberId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.memberService.delete(Number(req.params.restaurantId), Number(req.params.memberId));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
