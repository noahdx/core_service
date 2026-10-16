import { injectable } from 'tsyringe';
import { BranchEntity } from '../entity/branch.entity';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';
import { Currency } from '../types';

interface INearBranches {
  id: number;
  restaurantId: number;
  addressText: string;
  label: string;
  lat: number;
  lng: number;
  isActive: boolean;
  acceptOrders: boolean;
  currency: Currency;
  restaurantName: string;
  logoUrl: string;
}

@injectable()
export class BranchRepository {
  private COLUMNS = [
    'id',
    'restaurant_id',
    'country_code',
    'address_text',
    'label',
    'lat',
    'lng',
    'is_active',
    'opens_at',
    'closes_at',
    'accept_orders',
    'created_at',
    'updated_at',
    'delivery_radius',
    'currency',
    'commission',
    'location',
  ];

  async findById(id: number): Promise<BranchEntity | undefined> {
    const row = await db('restaurant_branches').where('id', id).select(this.COLUMNS).first();

    return row ? this.toEntity(row) : undefined;
  }

  async findByIds(ids: number[]): Promise<BranchEntity[]> {
    if (ids.length === 0) return [];
    const rows = await db('restaurant_branches').whereIn('id', ids).select(this.COLUMNS);
    return rows.map(this.toEntity);
  }

  async findByRestaurant(restaurantId: number): Promise<BranchEntity[]> {
    const rows = await db('restaurant_branches').where('restaurant_id', restaurantId).select(this.COLUMNS);
    return rows.map(this.toEntity);
  }

  async findNearBranches(lng: number, lat: number): Promise<INearBranches[]> {
    const result = await db.raw(
      `
       SELECT
       b.id,
       b.restaurant_id,
       b.address_text,
       b.label,
       b.lat,
       b.lng,
       b.is_active,
       b.accept_orders,
       b.currency,
       r.name AS restaurant_name,
       r.logo_url
       FROM restaurant_branches b JOIN restaurants r ON  b.restaurant_id = r.id
       WHERE b.is_active = true AND r.status ='active'
       AND ST_DWithin(b.location, ST_MakePoint(?, ?)::geography, b.delivery_radius*1000)
    `,
      [lng, lat],
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      addressText: row.address_text,
      label: row.label,
      lat: row.lat,
      lng: row.lng,
      isActive: row.is_active,
      acceptOrders: row.accept_orders,
      currency: row.currency,
      restaurantName: row.restaurant_name,
      logoUrl: row.logo_url,
    }));
  }

  async create(data: Partial<BranchEntity>, trx: Knex = db): Promise<BranchEntity> {
    const [row] = await trx('restaurant_branches')
      .insert({
        restaurant_id: data.restaurantId,
        country_code: data.countryCode,
        address_text: data.addressText,
        label: data.label,
        lat: data.lat,
        lng: data.lng,
        is_active: data.isActive,
        opens_at: data.opensAt,
        closes_at: data.closesAt,
        accept_orders: data.acceptOrders,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
        delivery_radius: data.deliveryRadius,
        currency: data.currency,
        commission: data.commission,
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  }

  async update(id: number, data: Partial<BranchEntity>): Promise<BranchEntity> {
    const mapping: Record<string, unknown> = {};
    mapping.updated_at = new Date();
    if (data.lng !== undefined) mapping.lng = data.lng;
    if (data.lat !== undefined) mapping.lat = data.lat;
    if (data.label !== undefined) mapping.label = data.label;
    if (data.opensAt !== undefined) mapping.opens_at = data.opensAt;
    if (data.currency !== undefined) mapping.currency = data.currency;
    if (data.closesAt !== undefined) mapping.closes_at = data.closesAt;
    if (data.addressText !== undefined) mapping.address_text = data.addressText;
    if (data.acceptOrders !== undefined) mapping.accept_orders = data.acceptOrders;
    if (data.deliveryRadius !== undefined) mapping.delivery_radius = data.deliveryRadius;

    const [row] = await db('restaurant_branches').where('id', id).update(mapping).returning(this.COLUMNS);

    return this.toEntity(row);
  }

  async updateStatus(id: number, data: Partial<BranchEntity>, conn: Knex = db): Promise<BranchEntity> {
    const mapping: Record<string, unknown> = {};
    mapping.updated_at = new Date();
    if (data.isActive !== undefined) mapping.is_active = data.isActive;
    if (data.commission !== undefined) mapping.commission = data.commission;

    const [row] = await conn('restaurant_branches').where('id', id).update(mapping).returning(this.COLUMNS);

    return this.toEntity(row);
  }

  private toEntity(row: any): BranchEntity {
    return new BranchEntity({
      id: row.id,
      restaurantId: row.restaurant_id,
      countryCode: row.country_code,
      addressText: row.address_text,
      label: row.label,
      lng: row.lng,
      lat: row.lat,
      isActive: row.is_active,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      acceptOrders: row.accept_orders,
      deliveryRadius: row.delivery_radius,
      currency: row.currency,
      commission: row.commission,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      location: row.location,
    });
  }
}
