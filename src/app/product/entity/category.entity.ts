export class CategoryEntity {
  id: number;
  restaurantId: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<CategoryEntity>) {
    this.id = data.id!;
    this.restaurantId = data.restaurantId!;
    this.name = data.name!;
    this.createdAt = data.createdAt!;
    this.updatedAt = data.updatedAt!;
  }
}
