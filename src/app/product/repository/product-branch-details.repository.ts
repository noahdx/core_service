import { injectable } from 'tsyringe';
import { ProductBranchDetailsEntity } from '../entity/product-branch-details.entity';
import { Knex } from 'knex';
import { db } from '../../../lib/knex/knex';

import { OutOfStockError } from '../../order/errors';

@injectable()
export class ProductBranchDetailsRepository {
  private COLUMNS = ['id', 'branch_id', 'product_id', 'price', 'stock', 'is_available'];

  async findByBranchAndProducts(branchId: number, productIds: number[]): Promise<ProductBranchDetailsEntity[]> {
    if (productIds.length === 0) return [];

    const rows = await db('product_branch_details')
      .select(this.COLUMNS)
      .where('branch_id', branchId)
      .whereIn('product_id', productIds);

    return rows.map(this.toEntity);
  }

  async reserveStock(branchId: number, items: { productId: number; quantity: number }[], trx: Knex = db): Promise<void> {
    if (items.length === 0) return;

    const placeholders = items.map(() => '(?, ?)').join(', ');
    const bindings = items.flatMap((item) => [item.productId, item.quantity]);

    const result = await trx.raw(
      `
      UPDATE product_branch_details AS pbd
      SET stock = pbd.stock - v.quantity::int
      FROM (VALUES ${placeholders}) AS v(product_id, quantity)
      WHERE pbd.branch_id = ?
        AND pbd.product_id = v.product_id::bigint
        AND pbd.stock >= v.quantity::int
      RETURNING pbd.product_id
      `,
      [...bindings, branchId],
    );

    if (result.rows.length !== items.length) {
      throw OutOfStockError;
    }
  }

  async releaseStock(branchId: number, items: { productId: number; quantity: number }[], trx: Knex = db): Promise<void> {
    if (items.length === 0) return;

    const placeholders = items.map(() => '(?, ?)').join(', ');
    const bindings = items.flatMap((item) => [item.productId, item.quantity]);

    await trx.raw(
      `
      UPDATE product_branch_details AS pbd
      SET stock = pbd.stock + v.quantity::int
      FROM (VALUES ${placeholders}) AS v(product_id, quantity)
      WHERE pbd.branch_id = ?
        AND pbd.product_id = v.product_id::bigint
      RETURNING pbd.product_id
      `,
      [...bindings, branchId],
    );
  }

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
