import { injectable } from 'tsyringe';
import { MemberBranchEntity } from '../entity/member-branch.entity';
import { db } from '../../../lib/knex/knex';
import { Knex } from 'knex';

@injectable()
export class MemberBranchRepository {
  async findBranchIdsByMemberId(memberId: number): Promise<number[]> {
    const rows = await db('member_branches').select('branch_id').where('member_id', memberId);
    return rows?.map((row) => row.branch_id); // [{branch_id:2}, {branch_id:3}] -> [2,3]
  }

  async setMemberBranches(memberId: number, rows: MemberBranchEntity[], trx: Knex = db) {
    // delete
    await trx('member_branches').where('member_id', memberId).delete();

    // insert
    if (rows.length > 0) {
      await trx('member_branches').insert(
        rows.map((row) => ({
          member_id: row.memberId,
          branch_id: row.branchId,
          created_at: row.createdAt,
        })),
      );
    }
  }

  async countBranchesByIdsAndRestaurant(branchIds: number[], restaurantId: number): Promise<number> {
    const [{ count }] = await db('restaurant_branches')
      .whereIn('id', branchIds)
      .andWhere('restaurant_id', restaurantId)
      .count('id as count');
    return Number(count);
  }

  private toEntity(row: any): MemberBranchEntity {
    return new MemberBranchEntity({
      memberId: row.member_id,
      branchId: row.branch_id,
      createdAt: row.created_at,
    });
  }
}
