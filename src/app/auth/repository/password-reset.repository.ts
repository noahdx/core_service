import { injectable } from 'tsyringe';
import { PasswordResetEntity } from '../entity/password-reset.entity';
import { db } from '../../../lib/knex/knex';
import { Knex } from 'knex';

@injectable()
export class PasswordResetRepository {
  private COLUMNS = ['id', 'user_id', 'otp_hash', 'expires_at', 'consumed_at', 'created_at'];

  async create(data: Partial<PasswordResetEntity>, trx: Knex = db): Promise<PasswordResetEntity> {
    const [row] = await trx('password_resets')
      .insert({
        user_id: data.userId,
        otp_hash: data.otpHash,
        created_at: data.createdAt,
        expires_at: data.expiresAt,
        consumed_at: data.consumedAt,
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  }

  async findLatestPasswordResetByUserId(userId: number): Promise<PasswordResetEntity | undefined> {
    const row = await db('password_resets')
      .where('user_id', userId)
      .whereNull('consumed_at')
      .orderBy('created_at', 'desc')
      .select(this.COLUMNS)
      .first();

    return row ? this.toEntity(row) : undefined;
  }

  async markAsConsumed(userId: number) {
    const row = await db('password_resets').where('user_id', userId).update({ consumed_at: new Date() });
  }

  private toEntity(raw: any): PasswordResetEntity {
    return new PasswordResetEntity({
      id: raw.id,
      userId: raw.user_id,
      otpHash: raw.otp_hash,
      createdAt: raw.created_at,
      expiresAt: raw.expires_at,
      consumedAt: raw.consumed_at,
    });
  }
}
