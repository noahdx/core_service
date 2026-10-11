import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { RoleRepository } from '../repository/role.repository';
import { RoleNotFoundError } from '../errors';
import { Knex } from 'knex';
import { RestaurantMemberRepository } from '../repository/restaurant_member.repository';
import { MemberStatus } from '../types';
import { MemberBranchRepository } from '../repository/member-branch.repository';

// Internal (service-to-service)
@injectable()
export class MemberInternalService {
  constructor(
    @inject(tokens.RoleRepository) private readonly roleRepository: RoleRepository,
    @inject(tokens.MemberBranchRepository) private readonly memberBranchRepository: MemberBranchRepository,
    @inject(tokens.RestaurantMemberRepository) private readonly restaurantMemberRepository: RestaurantMemberRepository,
  ) {}

  async activeMember(userId: number, trx?: Knex) {
    await this.restaurantMemberRepository.activateMemberByUserId(userId, trx);
  }

  async getRestaurantMemberWithRole(userId: number) {
    return await this.restaurantMemberRepository.findRestaurantMemberWithRole(userId);
  }

  async getBranchIdsByMemberId(memberId: number) {
    return await this.memberBranchRepository.findBranchIdsByMemberId(memberId);
  }

  async createOwnerMember(restaurantId: number, userId: number, trx?: Knex) {
    const ownerRoleId = await this.roleRepository.findByName('owner', trx);
    if (!ownerRoleId) {
      throw RoleNotFoundError;
    }

    const date = new Date();
    return await this.restaurantMemberRepository.create(
      {
        restaurantId,
        userId,
        roleId: ownerRoleId,
        status: MemberStatus.ACTIVE,
        createdAt: date,
        updatedAt: date,
      },
      trx,
    );
  }
}
