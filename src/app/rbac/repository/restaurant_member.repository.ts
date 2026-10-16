import { injectable } from 'tsyringe';
import { RestaurantMemberEntity } from '../entity/restaurant-member.entity';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';
import { MemberStatus } from '../types';

interface IFindByRestaurant {
  id: number;
  userId: number;
  email: string;
  name: string;
  phone: string;
  role: string;
  roleDisplayName: string;
  status: MemberStatus;
}
@injectable()
export class RestaurantMemberRepository {
  private COLUMNS = ['id', 'restaurant_id', 'user_id', 'role_id', 'status', 'created_at', 'updated_at'];

  async activateMemberByUserId(userId: number, trx: Knex = db): Promise<void> {
    await trx('restaurant_members').where('user_id', userId).update({ status: MemberStatus.ACTIVE, updated_at: new Date() });
  }
  async findMemberById(memberId: number, conn: Knex = db): Promise<RestaurantMemberEntity | undefined> {
    const row = await conn('restaurant_members').select(this.COLUMNS).where('id', memberId).first();
    return row ? this.toEntity(row) : undefined;
  }

  // By User ID
  async findRestaurantMemberWithRole(userId: number): Promise<{ member: RestaurantMemberEntity; roleName: string }> {
    const row = await db('restaurant_members as rm')
      .select('rm.restaurant_id', 'rm.id', 'r.name as roleName')
      .leftJoin('roles as r', 'rm.role_id', 'r.id')
      .where('rm.user_id', userId)
      .andWhere('rm.status', MemberStatus.ACTIVE)
      .first();

    return {
      member: this.toEntity(row),
      roleName: row.roleName,
    };
  }

  // By Member ID
  async findMemberWithRoleName(memberId: number): Promise<{ member: RestaurantMemberEntity; roleName: string } | undefined> {
    const row = await db('restaurant_members as rm')
      .select(...this.COLUMNS.map((c) => `rm.${c}`), 'r.name as roleName')
      .join('roles as r', 'rm.role_id', 'r.id')
      .where('rm.id', memberId)
      .first();

    return row ? { member: this.toEntity(row), roleName: row.roleName } : undefined;
  }

  async findMembersByRestaurantId(restaurantId: number): Promise<IFindByRestaurant[]> {
    const rows = await db('restaurant_members as rm')
      .select(
        'rm.id',
        'rm.user_id',
        'u.email',
        'u.name',
        'u.phone',
        'r.name as role',
        'r.display_name as roleDisplayName',
        'rm.status',
      )
      .join('users as u', 'rm.user_id', 'u.id')
      .join('roles as r', 'rm.role_id', 'r.id')
      .where('rm.restaurant_id', restaurantId);

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role,
      roleDisplayName: row.roleDisplayName,
      status: row.status,
    }));
  }

  async create(data: Partial<RestaurantMemberEntity>, trx: Knex = db): Promise<RestaurantMemberEntity> {
    const [row] = await trx('restaurant_members')
      .insert({
        restaurant_id: data.restaurantId,
        user_id: data.userId,
        role_id: data.roleId,
        status: data.status,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .returning(this.COLUMNS);
    return this.toEntity(row);
  }

  async update(memberId: number, data: { roleId?: number; status?: string; updatedAt: Date }, trx: Knex = db): Promise<void> {
    const mapping: Record<string, any> = {};
    mapping.updated_at = data.updatedAt;
    if (data.roleId !== undefined) mapping.role_id = data.roleId;
    if (data.status !== undefined) mapping.status = data.status;
    await trx('restaurant_members').where('id', memberId).update(mapping);
  }

  async deleteMember(memberId: number, trx: Knex = db): Promise<void> {
    await trx('member_branches').where('member_id', memberId).delete();
    await trx('restaurant_members').where('id', memberId).delete();
  }

  private toEntity(row: any): RestaurantMemberEntity {
    return new RestaurantMemberEntity({
      id: row.id,
      restaurantId: row.restaurant_id,
      userId: row.user_id,
      roleId: row.role_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
