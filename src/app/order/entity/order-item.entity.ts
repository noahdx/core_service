export class OrderItemEntity {
  id: number;
  orderId: number;
  productId: number;
  productBranchDetailId: number;
  quantity: number;
  unitPriceSnapshot: number;
  nameSnapshot: string;
  imageUrlSnapshot?: string | null;
  lineTotal: number;
  createdAt: Date;

  constructor(data: Partial<OrderItemEntity>) {
    this.id = data.id!;
    this.orderId = data.orderId!;
    this.productId = data.productId!;
    this.productBranchDetailId = data.productBranchDetailId!;
    this.quantity = data.quantity!;
    this.unitPriceSnapshot = data.unitPriceSnapshot!;
    this.nameSnapshot = data.nameSnapshot!;
    this.imageUrlSnapshot = data.imageUrlSnapshot ?? null;
    this.lineTotal = data.lineTotal!;
    this.createdAt = data.createdAt ?? new Date();
  }
}
