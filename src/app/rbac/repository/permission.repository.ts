import { injectable } from 'tsyringe';
import { PermissionEntity } from '../entity/permission.entity';
import { db } from '../../../lib/knex/knex';
import { Knex } from 'knex';

@injectable()
export class PermissionRepository {
  async findPermissionsByRoleName(roleName: string, trx: Knex = db): Promise<string[]> {
    const rows = await trx('permissions as p')
      .select('p.id', 'p.resource', 'p.action', 'p.created_at')
      .join('role_permissions as rp', 'p.id', 'rp.permission_id')
      .join('roles as r', 'rp.role_id', 'r.id')
      .where('r.name', roleName);

    return rows.map((row) => {
      const entity = this.toEntity(row);
      return `${entity.resource}:${entity.action}`; // core:product:create
    });
  }

  async findPermissionsDetailsByRoleName(roleName: string): Promise<{ permission: string }[]> {
    const rows = await db('permissions as p')
      .select('p.resource', 'p.action')
      .join('role_permissions as rp', 'p.id', 'rp.permission_id')
      .join('roles as r', 'rp.role_id', 'r.id')
      .where('r.name', roleName);
    return rows.map((row) => ({
      permission: `${row.resource}:${row.action}`,
    }));
  }

  private toEntity(row: any): PermissionEntity {
    return new PermissionEntity({
      id: row.id,
      resource: row.resource,
      action: row.action,
      createdAt: row.created_at,
    });
  }
}
