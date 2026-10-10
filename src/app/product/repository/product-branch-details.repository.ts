import { injectable } from 'tsyringe';
import { ProductBranchDetailsEntity } from '../entity/product-branch-details.entity';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';

@injectable()
export class ProductBranchDetailsRepository {
  private COLUMNS = ['id', 'branch_id', 'product_id', 'price', 'stock', 'is_available'];

  async updateBranchDetails(
    branchId: number,
    productId: number,
    data: Partial<ProductBranchDetailsEntity>,
    conn: Knex = db,
  ): Promise<ProductBranchDetailsEntity> {
    const mapping: Record<string, any> = {};
    if (data.price !== undefined) mapping.price = data.price;
    if (data.stock !== undefined) mapping.stock = data.stock;
    if (data.isAvailable !== undefined) mapping.is_available = data.isAvailable;

    const [row] = await conn('product_branch_details')
      .where('branch_id', branchId)
      .where('product_id', productId)
      .update({
        price: data.price,
        stock: data.stock,
        is_available: data.isAvailable,
      })
      .returning(this.COLUMNS);

    return this.toEntity(row);
  }

  private toEntity(row: any): ProductBranchDetailsEntity {
    return new ProductBranchDetailsEntity({
      id: row.id,
      branchId: row.branch_id,
      productId: row.product_id,
      price: row.price,
      stock: row.stock,
      isAvailable: row.is_available,
    });
  }
}
