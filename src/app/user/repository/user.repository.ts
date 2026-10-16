import { UserEntity } from '../entity/user.entity';
import { db } from '../../../lib/knex/knex';
import { Knex } from 'knex';

export class UserRepository {
  private readonly USER_COLUMNS = [
    'id',
    'email',
    'phone',
    'name',
    'password_hash',
    'system_role',
    'created_at',
    'updated_at',
    'deleted_at',
  ];

  async findByEmail(email: string): Promise<UserEntity | undefined> {
    const row = await db('users').where('email', email).select(this.USER_COLUMNS).first();

    return row ? this.toEntity(row) : undefined;
  }

  async findById(id: number): Promise<UserEntity | undefined> {
    const row = await db('users').where('id', id).select(this.USER_COLUMNS).first();

    return row ? this.toEntity(row) : undefined;
  }

  async findByIds(ids: number[]): Promise<UserEntity[]> {
    if (ids.length === 0) return [];
    const rows = await db('users').whereIn('id', ids).select(this.USER_COLUMNS);
    return rows.map((r) => this.toEntity(r));
  }

  async existsByEmail(email: string): Promise<boolean> {
    const result = await db.raw(`SELECT EXISTS (SELECT 1 FROM users WHERE email = ?)`, [email]);
    return result.rows[0].exists;
  }

  async create(data: Partial<UserEntity>, trx: Knex = db): Promise<UserEntity> {
    const [row] = await trx('users')
      .insert({
        email: data.email,
        phone: data.phone,
        name: data.name,
        password_hash: data.passwordHash,
        system_role: data.systemRole,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .returning(this.USER_COLUMNS);

    return this.toEntity(row);
  }

  async update(id: number, data: Partial<UserEntity>): Promise<UserEntity> {
    const mapping: Record<string, any> = { created_at: data.createdAt };
    if (data.name !== undefined) mapping.name = data.name;
    if (data.email !== undefined) mapping.email = data.email;
    const [row] = await db('users').where('id', id).update(mapping).returning(this.USER_COLUMNS);

    return this.toEntity(row);
  }

  async updatePassword(id: number, password: string): Promise<void> {
    await db('users').where('id', id).update({ password_hash: password });
  }

  private toEntity(row: any): UserEntity {
    return new UserEntity({
      id: row.id,
      email: row.email,
      phone: row.phone,
      name: row.name,
      passwordHash: row.password_hash,
      systemRole: row.system_role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  }
}
