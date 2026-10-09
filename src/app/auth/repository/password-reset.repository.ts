import { injectable } from 'tsyringe';
import { AuthEntity } from '../entity/auth.entity';
import { db } from '../../../lib/knex/knex';

@injectable()
export class AuthRepository {
  private PASSWORD_RESET_COLUMNS = ['id', 'user_id', 'otp_hash', 'expires_at', 'consumed_at', 'created_at'];

  async createPasswordReset(data: Partial<AuthEntity>): Promise<AuthEntity> {
    const [row] = await db('password_resets')
      .insert({
        user_id: data.userId,
        otp_hash: data.otpHash,
        created_at: data.createdAt,
        expires_at: data.expiresAt,
        consumed_at: data.consumedAt,
      })
      .returning(this.PASSWORD_RESET_COLUMNS);

    return this.toEntity(row);
  }

  async findLatestPasswordResetByUserId(userId: string): Promise<AuthEntity | undefined> {
    const row = await db('password_resets')
      .where('user_id', userId)
      .whereNull('consumed_at')
      .select(this.PASSWORD_RESET_COLUMNS)
      .first();

    return row ? this.toEntity(row) : undefined;
  }

  async updatePasswordResetConsumed(userId: string) {
    const row = await db('password_resets').where('user_id', userId).update({ consumed_at: new Date() });
  }

  private toEntity(raw: any): AuthEntity {
    return new AuthEntity({
      id: raw.id,
      userId: raw.user_id,
      otpHash: raw.otp_hash,
      createdAt: raw.created_at,
      expiresAt: raw.expires_at,
      consumedAt: raw.consumed_at,
    });
  }
}
