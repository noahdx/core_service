import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { db } from '../../../lib/knex/knex';
import { IEmailProvider } from '../../../pkg/email/email.interface';
import { AuthService } from '../../auth/service/auth.service';
import { UserService } from '../../user/service/user.service';
import { SystemRole } from '../../user/types';
import { CreateMemberDTO, UpdateMemberBranchesDTO, UpdateMemberDTO } from '../dto/member-req.dto';
import { RestaurantMemberItemResponseDTO, RestaurantMemberResponseDTO } from '../dto/member-res.dto';
import { MemberBranchEntity } from '../entity/member-branch.entity';
import {
  CannotAssignBranchesToOwnerError,
  CannotCreateOwnerUserError,
  CannotDeleteOwnerError,
  InvalidBranchIdsError,
  MemberNotFoundError,
  RoleNotFoundError,
  RoleQueryRequiredError,
} from '../errors';
import { MemberBranchRepository } from '../repository/member-branch.repository';
import { PermissionRepository } from '../repository/permission.repository';
import { RestaurantMemberRepository } from '../repository/restaurant_member.repository';
import { RoleRepository } from '../repository/role.repository';
import { memberInvitationEmail } from '../templates/password-reset';
import { MemberStatus } from '../types';

@injectable()
export class MemberService {
  constructor(
    @inject(tokens.AuthService) private readonly authService: AuthService,
    @inject(tokens.UserService) private readonly userService: UserService,
    @inject(tokens.RoleRepository) private readonly roleRepository: RoleRepository,
    @inject(tokens.PermissionRepository) private readonly permissionRepository: PermissionRepository,
    @inject(tokens.MemberBranchRepository) private readonly memberBranchRepository: MemberBranchRepository,
    @inject(tokens.RestaurantMemberRepository) private readonly restaurantMemberRepository: RestaurantMemberRepository,
    @inject(tokens.EmailProvider) private readonly emailProvider: IEmailProvider,
  ) {}

  async listMembers(restaurantId: number) {
    const members = await this.restaurantMemberRepository.findMembersByRestaurantId(restaurantId);
    return {
      message: 'Members retrieved successfully',
      data: members.map(RestaurantMemberItemResponseDTO.from),
    };
  }

  async getRolePermissions(roleName: string) {
    const roleId = await this.roleRepository.findByName(roleName);
    if (!roleId) {
      throw RoleNotFoundError;
    }
    const permissions = await this.permissionRepository.findPermissionsDetailsByRoleName(roleName);
    return {
      message: 'Role permissions retrieved successfully',
      role: roleName,
      permissions,
    };
  }

  async getPermissionsByRole(roleName: string) {
    if (!roleName) {
      throw RoleQueryRequiredError;
    }

    const permissions = await this.permissionRepository.findPermissionsByRoleName(roleName);
    return { role: roleName, permissions };
  }

  async create(restaurantId: number, data: CreateMemberDTO) {
    // don't accept owner role creation
    if (data.role == 'owner') {
      throw CannotCreateOwnerUserError;
    }

    // find roleId by role name
    const roleId = await this.roleRepository.findByName(data.role);
    if (!roleId) {
      throw RoleNotFoundError;
    }

    // validate branchIds belong to this restaurant
    const branchIds = data.branchIds || [];
    await this.validateBranchOwnership(branchIds, restaurantId);

    // create user, member, assign branches
    const trx = await db.transaction();
    try {
      const date = new Date();
      const user = await this.userService.create(
        {
          email: data.email,
          phone: data.phone,
          name: data.name,
          systemRole: SystemRole.RESTAURANT_USER,
          password: '',
        },
        trx,
      );

      const member = await this.restaurantMemberRepository.create(
        {
          restaurantId: restaurantId,
          userId: user.id,
          roleId: roleId,
          status: MemberStatus.INACTIVE,
          createdAt: date,
          updatedAt: date,
        },
        trx,
      );

      // assign branches
      const rows = branchIds.map(
        (branchId) =>
          new MemberBranchEntity({
            memberId: member.id,
            branchId: branchId,
            createdAt: date,
          }),
      );

      await this.memberBranchRepository.setMemberBranches(member.id, rows, trx);

      // generate otp, create password reset record and send email
      const otp = (await this.authService.createPasswordReset(user.email, trx)) as string;
      const email = memberInvitationEmail(user.email);
      await this.emailProvider.send(user.email, email.subject, email.html);

      await trx.commit();

      return {
        message: 'Member invited successfully',
        data: RestaurantMemberResponseDTO.from(member, {
          roleName: data.role,
          branchIds,
          user: {
            id: user.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
          },
        }),
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async update(restaurantId: number, memberId: number, data: UpdateMemberDTO) {
    // single query: member + role name
    const result = await this.restaurantMemberRepository.findMemberWithRoleName(memberId);
    if (!result || Number(result.member.restaurantId) !== Number(restaurantId)) {
      throw MemberNotFoundError;
    }

    let roleId;
    if (data.role) {
      roleId = await this.roleRepository.findByName(data.role);
      if (!roleId) {
        throw RoleNotFoundError;
      }
    }

    await this.restaurantMemberRepository.update(memberId, {
      status: data.status,
      roleId: roleId,
      updatedAt: new Date(),
    });

    return { message: 'Member updated successfully' };
  }

  async updateMemberBranches(restaurantId: number, memberId: number, data: UpdateMemberBranchesDTO) {
    // single query: member + role name
    const result = await this.restaurantMemberRepository.findMemberWithRoleName(memberId);

    if (!result || Number(result.member.restaurantId) !== restaurantId) {
      throw MemberNotFoundError;
    }

    if (result.roleName === 'owner') {
      throw CannotAssignBranchesToOwnerError;
    }

    // validate branchIds belong to this restaurant
    await this.validateBranchOwnership(data.branchIds, restaurantId);

    const date = new Date();
    const rows = data.branchIds.map(
      (branchId) =>
        new MemberBranchEntity({
          branchId,
          memberId: result.member.id,
          createdAt: date,
        }),
    );

    await this.memberBranchRepository.setMemberBranches(memberId, rows);

    return {
      message: 'Member branch assignments updated successfully',
      branchIds: data.branchIds,
    };
  }

  async delete(restaurantId: number, memberId: number) {
    // single query: member + role name (no N+1)
    const result = await this.restaurantMemberRepository.findMemberWithRoleName(memberId);
    if (!result || Number(result.member.restaurantId) !== Number(restaurantId)) {
      throw MemberNotFoundError;
    }

    if (result.roleName === 'owner') {
      throw CannotDeleteOwnerError;
    }

    await this.restaurantMemberRepository.deleteMember(memberId);
    return { message: 'Member deleted successfully' };
  }

  // --- Helpers to validate branchIds belong to this restaurant (single COUNT query) ---
  async validateBranchOwnership(branchIds: number[], restaurantId: number) {
    if (branchIds.length === 0) return;
    const count = await this.memberBranchRepository.countBranchesByIdsAndRestaurant(branchIds, restaurantId);
    if (count !== branchIds.length) {
      throw InvalidBranchIdsError;
    }
  }
}
