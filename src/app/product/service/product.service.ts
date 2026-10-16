import { inject, injectable } from 'tsyringe';
import { UnAuthorizedError } from '../../../lib/auth/errors';
import { tokens } from '../../../lib/di/tokens';
import { buildPaginationResult, IFilterParams, IPaginationParams } from '../../../lib/http/pagination/cursor-pagination';
import { RestaurantNotFoundError } from '../../restaurant/errors';
import { RestaurantService } from '../../restaurant/service/restaurant.service';
import { SystemRole } from '../../user/types';
import { CreateProductDTO, UpdateProductDTO } from '../dto/product-req.dto';
import { CategoryResponseDTO, ProductResponseDTO } from '../dto/product-res.dto';
import { ProductNotFoundError } from '../errors';
import { CategoryRepository } from '../repository/category.repository';
import { ProductBranchDetailsRepository } from '../repository/product-branch-details.repository';
import { ProductRepository } from '../repository/product.repository';

@injectable()
export class ProductService {
  constructor(
    @inject(tokens.ProductRepository) private readonly productRepository: ProductRepository,
    @inject(tokens.RestaurantService) private readonly restaurantService: RestaurantService,
    @inject(tokens.ProductCategoryRepository) private readonly categoryRepository: CategoryRepository,
    @inject(tokens.PBDRepository) private readonly pbdRepository: ProductBranchDetailsRepository,
  ) {}

  async findById(id: number, columns?: string[]) {
    const product = await this.productRepository.findById(id, columns);
    if (!product) {
      throw ProductNotFoundError;
    }

    return {
      message: 'Product retrieved successfully',
      data: ProductResponseDTO.from(product),
    };
  }

  async findByIds(ids: number[], columns?: string[]) {
    const products = await this.productRepository.findByIds(ids, columns);
    return {
      message: 'Products retrieved successfully',
      data: products.map((p) => ProductResponseDTO.from(p)),
    };
  }

  async findByRestaurant(
    restaurantId: number,
    userId: number,
    userRole: SystemRole,
    params: IPaginationParams,
    filters: IFilterParams[],
  ) {
    const restaurant = await this.restaurantService.getById(restaurantId);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    if (userRole !== SystemRole.SYSTEM_ADMIN && Number(restaurant.data.ownerId) !== userId) {
      throw UnAuthorizedError;
    }
    const products = await this.productRepository.findByRestaurant(restaurantId, params, filters);
    const mapped = products.map((p) => ProductResponseDTO.from(p));
    return buildPaginationResult(mapped, params.limit, params.sortBy);
  }

  async findByBranch(branchId: number, params: IPaginationParams, filters: IFilterParams[]) {
    const products = await this.productRepository.findByBranch(branchId, params, filters);
    return buildPaginationResult(products, params.limit, params.sortBy);
  }

  async findCategories(restaurantId: number) {
    const categories = await this.categoryRepository.findByRestaurant(restaurantId);

    return {
      message: 'Categories retrieved successfully',
      data: categories.map(CategoryResponseDTO.from),
    };
  }

  async create(restaurantId: number, userId: number, userRole: SystemRole, data: CreateProductDTO) {
    await this.validateRestaurantAccess(restaurantId, userId, userRole);

    let categoryId = await this.getOrCreateCategory(restaurantId, data.categoryName);

    const date = new Date();
    const product = await this.productRepository.create({
      restaurantId: restaurantId,
      categoryId: categoryId,
      name: data.name,
      description: data.description,
      imgUrl: data.imgUrl,
      createdAt: date,
      updatedAt: date,
    });

    return {
      message: 'Product created successfully',
      data: ProductResponseDTO.from(product),
    };
  }

  async update(userRole: SystemRole, userId: number, id: number, data: UpdateProductDTO, branchId?: number) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw ProductNotFoundError;
    }

    const restaurant = await this.validateRestaurantAccess(product.restaurantId, userId, userRole);

    let categoryId = await this.getOrCreateCategory(restaurant.data.id, data.categoryName);

    const date = new Date();
    const updated = await this.productRepository.update(id, {
      name: data.name,
      imgUrl: data.imgUrl,
      categoryId: categoryId,
      description: data.description,
    });

    let branchDetails: Record<string, any> = {};
    if (branchId && (data.price !== undefined || data.stock !== undefined || data.isAvailable !== undefined)) {
      branchDetails = await this.pbdRepository.updateBranchDetails(branchId, product.id, {
        price: data.price,
        stock: data.stock,
        isAvailable: data.isAvailable,
      });
    }

    return {
      message: 'Product updated successfully',
      data: {
        ...ProductResponseDTO.from(updated),
        ...branchDetails,
      },
    };
  }

  // --- Helpers to remove duplicate code ---
  private async validateRestaurantAccess(restaurantId: number, userId: number, userRole: SystemRole) {
    const restaurant = await this.restaurantService.getById(restaurantId);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    if (userRole !== SystemRole.SYSTEM_ADMIN && Number(restaurant.data.ownerId) !== Number(userId)) {
      throw UnAuthorizedError;
    }

    return restaurant;
  }

  private async getOrCreateCategory(restaurantId: number, categoryName?: string) {
    if (!categoryName) {
      return null;
    }

    let category = await this.categoryRepository.findByName(restaurantId, categoryName);
    if (!category) {
      const now = new Date();
      category = await this.categoryRepository.create({
        restaurantId,
        name: categoryName,
        createdAt: now,
        updatedAt: now,
      });
    }

    return category.id;
  }
}
