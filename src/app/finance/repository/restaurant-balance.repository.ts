import { injectable } from 'tsyringe';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';
import { RestaurantBalanceEntity } from '../entity/restaurant-balance.entity';

@injectable()
export class RestaurantBalanceRepository {
  private COLUMNS = ['restaurant_id', 'balance', 'updated_at'];

  findByRestaurantId = async (restaurantId: number, conn: Knex = db): Promise<RestaurantBalanceEntity | undefined> => {
    const row = await conn('restaurant_balances').where('restaurant_id', restaurantId).select(this.COLUMNS).first();

    return row ? this.toEntity(row) : undefined;
  };

  getForUpdate = async (restaurantId: number, trx: Knex): Promise<RestaurantBalanceEntity | undefined> => {
    const row = await trx('restaurant_balances').where('restaurant_id', restaurantId).select(this.COLUMNS).forUpdate().first();

    return row ? this.toEntity(row) : undefined;
  };

  upsertIncrement = async (restaurantId: number, amount: number, trx: Knex): Promise<RestaurantBalanceEntity> => {
    const result = await trx.raw(
      `
      INSERT INTO restaurant_balances (restaurant_id, balance, updated_at)
      VALUES (?, ?, NOW())
      ON CONFLICT (restaurant_id)
      DO UPDATE SET balance = restaurant_balances.balance + EXCLUDED.balance, updated_at = NOW()
      RETURNING restaurant_id, balance, updated_at
      `,
      [restaurantId, amount],
    );

    const row = result.rows[0];
    return this.toEntity(row);
  };

  decrement = async (restaurantId: number, amount: number, trx: Knex): Promise<RestaurantBalanceEntity> => {
    const [row] = await trx('restaurant_balances')
      .where('restaurant_id', restaurantId)
      .decrement('balance', amount)
      .update({ updated_at: new Date() })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  };

  private toEntity = (row: any): RestaurantBalanceEntity => {
    return new RestaurantBalanceEntity({
      restaurantId: Number(row.restaurant_id),
      balance: Number(row.balance),
      updatedAt: row.updated_at,
    });
  };
}
