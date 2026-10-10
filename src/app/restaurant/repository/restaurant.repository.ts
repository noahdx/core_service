import { injectable } from 'tsyringe';
import { RestaurantEntity } from '../entity/restaurant.entity';
import { db } from '../../../lib/knex/knex';
import { Knex } from 'knex';

@injectable()
export class RestaurantRepository {
  private COLUMNS = [
    'id',
    'owner_id',
    'name',
    'status',
    'primary_country',
    'logo_url',
    'created_at',
    'updated_at',
    'updated_at',
  ];

  async findById(id: number) {
    const row = await db('restaurants').where('id', id).select(this.COLUMNS).first();
    return this.toEntity(row);
  }

  async create(data: Partial<RestaurantEntity>, trx: Knex = db): Promise<RestaurantEntity> {
    const [row] = await trx('restaurants')
      .insert({
        owner_id: data.ownerId,
        name: data.name,
        status: data.status,
        primary_country: data.primaryCountry,
        logo_url: data.logoUrl,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  }

  async update(id: number, data: Partial<RestaurantEntity>): Promise<RestaurantEntity> {
    const mapping: Record<string, any> = {};
    mapping.updated_at = data.updatedAt;
    if (data.name !== undefined) mapping.name = data.name;
    if (data.primaryCountry !== undefined) mapping.primary_country = data.primaryCountry;
    if (data.logoUrl !== undefined) mapping.logo_url = data.logoUrl;

    const [row] = await db('restaurants').where('id', id).update(mapping).returning(this.COLUMNS);
    return this.toEntity(row);
  }

  async updateStatus(id: number, staus: string): Promise<RestaurantEntity> {
    const [row] = await db('restaurants')
      .where('id', id)
      .update({
        status: staus,
        updated_at: new Date(),
      })
      .returning(this.COLUMNS);
    return this.toEntity(row);
  }

  private toEntity(row: any): RestaurantEntity {
    return new RestaurantEntity({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      status: row.status,
      primaryCountry: row.primary_country,
      logoUrl: row.logo_url,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
