import { Knex } from 'knex';
import { injectable } from 'tsyringe';
import { db } from '../../../lib/knex/knex';
import { OrderItemEntity } from '../entity/order-item.entity';

@injectable()
export class OrderItemRepository {
  private COLUMNS = [
    'id',
    'order_id',
    'product_id',
    'product_branch_detail_id',
    'quantity',
    'unit_price_snapshot',
    'name_snapshot',
    'image_url_snapshot',
    'line_total',
    'created_at',
  ];

  async bulkInsert(items: Partial<OrderItemEntity>[], trx: Knex = db): Promise<OrderItemEntity[]> {
    if (items.length === 0) return [];

    const rows = await trx('order_items')
      .insert(
        items.map((it) => ({
          order_id: it.orderId,
          product_id: it.productId,
          product_branch_detail_id: it.productBranchDetailId,
          quantity: it.quantity,
          unit_price_snapshot: it.unitPriceSnapshot,
          name_snapshot: it.nameSnapshot,
          image_url_snapshot: it.imageUrlSnapshot ?? null,
          line_total: it.lineTotal,
          created_at: it.createdAt ?? new Date(),
        })),
      )
      .returning(this.COLUMNS);

    return rows.map(this.toEntity);
  }

  async findByOrderId(orderId: number, conn: Knex = db): Promise<OrderItemEntity[]> {
    const rows = await conn('order_items').where('order_id', orderId).select(this.COLUMNS);
    return rows.map(this.toEntity);
  }

  async findByOrderIds(orderIds: number[], conn: Knex = db): Promise<OrderItemEntity[]> {
    if (orderIds.length === 0) return [];
    const rows = await conn('order_items').whereIn('order_id', orderIds).select(this.COLUMNS);
    return rows.map(this.toEntity);
  }

  private toEntity = (row: any): OrderItemEntity => {
    return new OrderItemEntity({
      id: Number(row.id),
      orderId: Number(row.order_id),
      productId: Number(row.product_id),
      productBranchDetailId: Number(row.product_branch_detail_id),
      quantity: Number(row.quantity),
      unitPriceSnapshot: Number(row.unit_price_snapshot),
      nameSnapshot: row.name_snapshot,
      imageUrlSnapshot: row.image_url_snapshot,
      lineTotal: Number(row.line_total),
      createdAt: row.created_at,
    });
  };
}
