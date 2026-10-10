import { injectable } from 'tsyringe';
import { CategoryEntity } from '../entity/category.entity';
import { db } from '../../../lib/knex/knex';
import { Knex } from 'knex';

@injectable()
export class CategoryRepository {
  private COLUMNS = ['id', 'restaurant_id', 'name', 'created_at', 'updated_at'];

  async findByName(restaurantId: number, name: string): Promise<CategoryEntity | undefined> {
    const row = await db('product_categories')
      .select(this.COLUMNS)
      .where('restaurant_id', restaurantId)
      .where('name', name)
      .first();
    return row ? this.toEntity(row) : undefined;
  }

  async findByRestaurant(restaurantId: number): Promise<CategoryEntity[]> {
    const rows = await db('product_categories').select(this.COLUMNS).where('restaurant_id', restaurantId);
    return rows.map(this.toEntity);
  }

  async create(data: Partial<CategoryEntity>, trx: Knex = db): Promise<CategoryEntity> {
    const [row] = await trx('product_categories')
      .insert({
        restaurant_id: data.restaurantId,
        name: data.name,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .returning(this.COLUMNS);
    return this.toEntity(row);
  }

  private toEntity(row: any): CategoryEntity {
    return new CategoryEntity({
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
