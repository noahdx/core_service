import { Knex } from 'knex';
import { inject, injectable } from 'tsyringe';
import { UnAuthorizedError } from '../../../lib/auth/errors';
import { tokens } from '../../../lib/di/tokens';
import { buildPaginationResult, IFilterParams, IPaginationParams } from '../../../lib/http/pagination/cursor-pagination';
import { db } from '../../../lib/knex/knex';
import { UserAlreadyExistsError } from '../../user/errors';
import { UserService } from '../../user/service/user.service';
import { SystemRole } from '../../user/types';
import {
  CreateRestaurantDTO,
  RegisterRestaurantDTO,
  UpdatedRestaurantDTO,
  UpdateRestaurantStatusDTO,
} from '../dto/restaurant-req-.dto';
import { RestaurantNotFoundError } from '../errors';
import { RestaurantRepository } from '../repository/restaurant.repository';
import { RestaurantStatus } from '../types';

@injectable()
export class RestaurantService {
  constructor(
    @inject(tokens.RestaurantRepository) private restaurantRepository: RestaurantRepository,
    @inject(tokens.UserService) private userService: UserService,
  ) {}

  async getById(id: number) {
    const restaurant = await this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    return { data: restaurant };
  }

  async getAll(params: IPaginationParams, filters: IFilterParams[]) {
    const restaurants = await this.restaurantRepository.findAll(params, filters);
    return buildPaginationResult(restaurants, params.limit, params.orderBy);
  }

  async createWithOwner(systemRole: SystemRole, data: RegisterRestaurantDTO) {
    if (systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw UnAuthorizedError;
    }

    const userExists = await this.userService.existsByEmail(data.owner.email);
    if (userExists) {
      throw UserAlreadyExistsError;
    }

    const trx = await db.transaction();

    try {
      const user = await this.userService.create(
        {
          email: data.owner.email,
          phone: data.owner.phone,
          name: data.owner.name,
          systemRole: SystemRole.RESTAURANT_USER,
          password: data.owner.password,
        },
        trx,
      );

      const restaurant = await this.create(
        user.id,
        {
          name: data.name,
          primaryCountry: data.primaryCountry,
          logoURL: data.logoURL,
        },
        trx,
      );

      await trx.commit();

      return {
        restaurant,
        owner: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          systemRole: user.systemRole,
        },
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async create(userId: number, data: CreateRestaurantDTO, trx?: Knex) {
    const date = new Date();
    return await this.restaurantRepository.create(
      {
        ownerId: userId,
        name: data.name,
        status: RestaurantStatus.PENDING,
        primaryCountry: data.primaryCountry,
        logoUrl: data.logoURL,
        createdAt: date,
        updatedAt: date,
      },
      trx,
    );
  }

  async update(userId: number, id: number, data: UpdatedRestaurantDTO) {
    const restaurant = await this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    if (userId !== restaurant.ownerId) {
      throw RestaurantNotFoundError;
    }

    const updated = await this.restaurantRepository.update(id, data);

    return { data: updated };
  }

  async updateStatus(systemRole: SystemRole, id: number, data: UpdateRestaurantStatusDTO) {
    if (systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw UnAuthorizedError;
    }

    const restaurant = await this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    const updated = await this.restaurantRepository.updateStatus(id, data.status);

    return { data: updated };
  }
}
