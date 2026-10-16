import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { BranchRepository } from '../repository/branch.repository';
import { BranchNotFoundError } from '../errors';
import { RestaurantService } from '../../restaurant/service/restaurant.service';
import { RestaurantNotFoundError } from '../../restaurant/errors';
import { CreateBranchDTO, UpdateBranchDTO, UpdateBranchStatusDTO } from '../dto/branch-req.dto';
import { BranchResponseDTO, NearBranchResponseDTO } from '../dto/branch-res.dto';
import { SystemRole } from '../../user/types';
import { UnAuthorizedError } from '../../../lib/auth/errors';

@injectable()
export class BranchService {
  constructor(
    @inject(tokens.BranchRepository) private readonly branchRepository: BranchRepository,
    @inject(tokens.RestaurantService) private readonly restaurantService: RestaurantService,
  ) {}

  async getById(id: number) {
    const branch = await this.branchRepository.findById(id);

    if (!branch) {
      throw BranchNotFoundError;
    }

    return {
      message: 'Branch retrieved successfully.',
      data: BranchResponseDTO.from(branch),
    };
  }

  async findByIdWithRestaurant(branchId: number) {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) {
      throw BranchNotFoundError;
    }
    const restaurant = await this.restaurantService.getById(branch.restaurantId);

    return {
      message: 'success',
      data: {
        id: branch.id,
        restaurantId: branch.restaurantId,
        name: branch.label,
        addressText: branch.addressText,
        restaurantStatus: restaurant.data.status,
        region: branch.countryCode,
        isActive: branch.isActive,
        acceptOrders: branch.acceptOrders,
        commissionBps: branch.commission,
        currency: branch.currency,
        lat: Number(branch.lat),
        lng: Number(branch.lng),
      },
    };
  }

  async getByRestaurant(restaurantId: number) {
    const restaurant = await this.restaurantService.getById(restaurantId);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    const branches = await this.branchRepository.findByRestaurant(restaurantId);

    return {
      message: 'Branches retrieved successfully.',
      data: branches.map(BranchResponseDTO.from),
    };
  }

  async getNearBranches(lng: number, lat: number) {
    const branches = await this.branchRepository.findNearBranches(lng, lat);

    return {
      message: 'Branches retrieved successfully.',
      data: branches.map(NearBranchResponseDTO.from),
    };
  }

  async create(userId: number, systemRole: SystemRole, restaurantId: number, data: CreateBranchDTO) {
    // RBAC will only allow this point for admin and owner
    const restaurant = await this.restaurantService.getById(restaurantId);

    if (userId !== restaurant.data.ownerId && systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw UnAuthorizedError;
    }

    const date = new Date();
    const branch = await this.branchRepository.create({
      restaurantId: restaurantId,
      countryCode: data.countryCode,
      label: data.label,
      addressText: data.addressText,
      lat: data.lat,
      lng: data.lng,
      opensAt: data.opensAt,
      closesAt: data.closesAt,
      isActive: false,
      acceptOrders: true,
      currency: data.currency,
      commission: 0,
      deliveryRadius: data.deliveryRadius,
      createdAt: date,
      updatedAt: date,
    });

    return {
      message: 'Branch created successfully',
      data: BranchResponseDTO.from(branch),
    };
  }

  async update(userId: number, systemRole: SystemRole, id: number, data: UpdateBranchDTO) {
    const branch = await this.branchRepository.findById(id);
    if (!branch) {
      throw BranchNotFoundError;
    }

    const restaurant = await this.restaurantService.getById(branch.restaurantId);

    if (userId !== restaurant.data.ownerId && systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw UnAuthorizedError;
    }

    const updated = await this.branchRepository.update(id, data);

    return {
      message: 'Branch updated successfully',
      data: BranchResponseDTO.from(updated),
    };
  }

  async updateStatus(systemRole: SystemRole, id: number, data: UpdateBranchStatusDTO) {
    if (systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw UnAuthorizedError;
    }

    const branch = await this.branchRepository.findById(id);
    if (!branch) {
      throw BranchNotFoundError;
    }

    const updated = await this.branchRepository.updateStatus(id, data);

    return {
      message: 'Branch updated successfully',
      data: BranchResponseDTO.from(updated),
    };
  }
}
