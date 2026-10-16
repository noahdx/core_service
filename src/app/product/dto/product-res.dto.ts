import { CategoryEntity } from '../entity/category.entity';
import { ProductEntity } from '../entity/product.entity';
import { ProductBranchDetailsEntity } from '../entity/product-branch-details.entity';

export class CategoryResponseDTO {
  id!: number;
  restaurantId!: number;
  name!: string;
  createdAt!: string;
  updatedAt!: string;

  static from(entity: CategoryEntity): CategoryResponseDTO {
    return {
      id: entity.id,
      restaurantId: entity.restaurantId,
      name: entity.name,
      createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export class ProductBranchDetailResponseDTO {
  id!: number;
  branchId!: number;
  productId!: number;
  price!: number;
  stock!: number;
  isAvailable!: boolean;

  static from(entity: ProductBranchDetailsEntity): ProductBranchDetailResponseDTO {
    return {
      id: entity.id,
      branchId: entity.branchId,
      productId: entity.productId,
      price: Number(entity.price),
      stock: Number(entity.stock),
      isAvailable: Boolean(entity.isAvailable),
    };
  }
}

export class ProductResponseDTO {
  id!: number;
  restaurantId!: number;
  categoryId!: number | null;
  name!: string;
  description!: string | null;
  imgUrl!: string | null;
  createdAt!: string;
  updatedAt!: string;
  branchDetails?: ProductBranchDetailResponseDTO[];

  static from(entity: ProductEntity, branchDetails?: ProductBranchDetailsEntity[]): ProductResponseDTO {
    return {
      id: entity.id,
      restaurantId: entity.restaurantId,
      categoryId: entity.categoryId ?? null,
      name: entity.name,
      description: entity.description ?? null,
      imgUrl: entity.imgUrl ?? null,
      createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
      branchDetails: branchDetails ? branchDetails.map(ProductBranchDetailResponseDTO.from) : undefined,
    };
  }
}
