export class ProductEntity {
  id: number;
  restaurantId: number;
  categoryId: number | null;
  name: string;
  description: string;
  imgUrl: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(data: Partial<ProductEntity>) {
    this.id = data.id!;
    this.restaurantId = data.restaurantId!;
    this.categoryId = data.categoryId ?? null;
    this.name = data.name!;
    this.description = data.description ?? '';
    this.imgUrl = data.imgUrl ?? '';
    this.createdAt = data.createdAt!;
    this.updatedAt = data.updatedAt!;
    this.deletedAt = data.deletedAt ?? null;
  }
}
