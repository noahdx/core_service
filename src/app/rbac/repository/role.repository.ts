import { injectable } from 'tsyringe';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';
import { RoleEntity } from '../entity/role.entity';

@injectable()
export class RoleRepository {
  private COLUMNS = ['id', 'name', 'display_name', 'created_at', 'updated_at'];

  async findByName(name: string, trx: Knex = db): Promise<number | undefined> {
    const row = await trx('roles').select('id').where('name', name).first();

    return row ? row.id : undefined;
  }

  private toEntity(row: any): RoleEntity {
    return new RoleEntity({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
