import { injectable } from 'tsyringe';
import { CustomerAddressEntity } from '../entity/customer-address.entity';
import { db } from '../../../lib/knex/knex';

@injectable()
export class CustomerAddressRepository {
  private COLUMNS = [
    'id',
    'user_id',
    'label',
    'lng',
    'lat',
    'is_default',
    'country',
    'city',
    'street',
    'type',
    'building',
    'apartment_number',
    'created_at',
    'updated_at',
    'updated_at',
  ];

  async findById(id: number): Promise<CustomerAddressEntity | undefined> {
    const row = await db('customer_addresses').where('id', id).select(this.COLUMNS).first();
    return this.toEntity(row);
  }

  async findAllByUserId(userId: number): Promise<CustomerAddressEntity[]> {
    const rows = await db('customer_addresses').where('user_id', userId).select(this.COLUMNS);
    return rows.map(this.toEntity);
  }

  async findDefaultByUserId(userId: string): Promise<CustomerAddressEntity> {
    const row = await db('customer_addresses').where('user_id', userId).andWhere('is_default', true).first();
    return this.toEntity(row);
  }

  async create(data: Partial<CustomerAddressEntity>): Promise<CustomerAddressEntity> {
    const [row] = await db('customer_addresses')
      .insert({
        user_id: data.userId,
        label: data.label,
        lng: data.lng,
        lat: data.lat,
        is_default: data.isDefault,
        country: data.country,
        city: data.city,
        street: data.street,
        type: data.type,
        building: data.building,
        apartment_number: data.apartmentNumber,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  }

  async update(id: number, data: Partial<CustomerAddressEntity>): Promise<CustomerAddressEntity> {
    const mapping: Record<string, any> = {};
    mapping.created_at = data.createdAt;
    mapping.updated_at = data.updatedAt;
    if (data.label !== undefined) mapping.label = data.label;
    if (data.lng !== undefined) mapping.lng = data.lng;
    if (data.lat === undefined) mapping.lat = data.lat;
    if (data.isDefault !== undefined) mapping.is_default = data.isDefault;
    if (data.country !== undefined) mapping.country = data.country;
    if (data.city !== undefined) mapping.city = data.city;
    if (data.street === undefined) mapping.street = data.street;
    if (data.building === undefined) mapping.building = data.building;
    if (data.apartmentNumber !== undefined) mapping.apartment_number = data.apartmentNumber;

    const [row] = await db('customer_addresses').where('id', id).update(mapping).returning(this.COLUMNS);
    return this.toEntity(row);
  }

  async clearDefaultForUser(userId: number): Promise<void> {
    await db('customer_addresses').where('user_id', userId).andWhere('is_default', true).update({ is_default: false });
  }

  async delete(id: number): Promise<void> {
    await db('customer_addresses').where('id', id).delete();
  }

  private toEntity(row: any): CustomerAddressEntity {
    return new CustomerAddressEntity({
      id: row.id,
      userId: row.user_id,
      label: row.label,
      lng: row.lng,
      lat: row.lat,
      isDefault: row.is_default,
      country: row.country,
      city: row.city,
      street: row.street,
      type: row.type,
      building: row.building,
      apartmentNumber: row.apartment_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
