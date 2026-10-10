import { injectable } from 'tsyringe';
import { ProductEntity } from '../entity/product.entity';
import { db } from '../../../lib/knex/knex';

interface IFindByBranch {
  id: number;
  restaurantId: number;
  categoryId: number | null;
  name: string;
  description: string;
  imgUrl: string;
  categoryName: string;
  price: number;
  stock: number;
  isAvailable: boolean;
}

@injectable()
export class ProductRepository {
  private COLUMNS = [
    'id',
    'restaurant_id',
    'category_id',
    'name',
    'description',
    'img_url',
    'created_at',
    'updated_at',
    'deleted_at',
  ];

  async findById(id: number): Promise<ProductEntity | undefined> {
    const row = await db('products').select(this.COLUMNS).where('id', id).whereNull('deleted_at').first();
    return row ? this.toEntity(row) : undefined;
  }

  async findByRestaurant(restaurantId: number): Promise<ProductEntity[]> {
    const rows = await db('products').select(this.COLUMNS).where('restaurant_id', restaurantId).whereNull('deleted_at');
    return rows.map(this.toEntity);
  }

  async findByBranch(branchId: number): Promise<IFindByBranch[]> {
    const rows = await db('products as p')
      .join('product_branch_details as pbd', 'p.id', 'pbd.product_id')
      .leftJoin('product_categories as pc', 'p.category_id', 'pc.id')
      .where('pbd.branch_id', branchId)
      .whereNull('p.deleted_at')
      .select(
        'p.id',
        'p.name',
        'p.description',
        'p.img_url',
        'p.restaurant_id',
        'p.category_id',
        'pc.name as category_name',
        'pbd.price',
        'pbd.stock',
        'pbd.is_available',
      );
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      imgUrl: row.img_url,
      restaurantId: row.restaurant_id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      price: row.price,
      stock: row.stock,
      isAvailable: row.is_available,
    }));
  }

  async create(data: Partial<ProductEntity>): Promise<ProductEntity> {
    const [row] = await db('products')
      .insert({
        restaurant_id: data.restaurantId,
        category_id: data.categoryId,
        name: data.name,
        description: data.description,
        img_url: data.imgUrl,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  }

  async update(id: number, data: Partial<ProductEntity>): Promise<ProductEntity> {
    const mapping: Record<string, any> = {};
    mapping.updated_at = data.updatedAt;
    if (data.name !== undefined) mapping.name = data.name;
    if (data.imgUrl !== undefined) mapping.img_url = data.imgUrl;
    if (data.categoryId !== undefined) mapping.category_id = data.categoryId;
    if (data.description !== undefined) mapping.description = data.description;

    const [row] = await db('products').where('id', id).update(mapping).returning(this.COLUMNS);

    return this.toEntity(row);
  }

  private toEntity(row: any): ProductEntity {
    return new ProductEntity({
      id: row.id,
      restaurantId: row.restaurant_id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      imgUrl: row.img_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  }
}
