import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { CustomerAddressRepository } from '../repository/customer-address.repository';
import { CreateAddressDTO, UpdateAddressDTO } from '../dto/customer-address-req.dto';
import { UserService } from '../../user/service/user.service';
import { AddressNotFoundError } from '../errors';

@injectable()
export class CustomerAddressService {
  constructor(
    @inject(tokens.CustomerAddressRepository) private readonly customerAddressRepository: CustomerAddressRepository,
    @inject(tokens.UserService) private readonly userService: UserService,
  ) {}

  async getById(id: number) {
    const address = await this.customerAddressRepository.findById(id);

    if (!address) {
      throw AddressNotFoundError;
    }
    return {
      message: 'Address retrieved successfully',
      data: address,
    };
  }

  async getAll(userId: number) {
    const addresses = await this.customerAddressRepository.findAllByUserId(userId);
    return {
      message: 'Addresses retrieved successfully',
      data: addresses,
    };
  }

  async create(userId: number, data: CreateAddressDTO) {
    if (data.isDefault) {
      await this.customerAddressRepository.clearDefaultForUser(userId);
    }

    const date = new Date();
    const address = await this.customerAddressRepository.create({
      userId: userId,
      label: data.label,
      lng: data.lng,
      lat: data.lat,
      isDefault: data.isDefault,
      type: data.type,
      country: data.country,
      city: data.city,
      street: data.street,
      building: data.building,
      apartmentNumber: data.apartmentNumber,
      createdAt: date,
      updatedAt: date,
    });

    return {
      message: 'Address created successfully',
      data: address,
    };
  }

  async update(id: number, data: UpdateAddressDTO) {
    const address = await this.customerAddressRepository.findById(id);
    if (!address) {
      throw AddressNotFoundError;
    }

    const updated = await this.customerAddressRepository.update(id, data);

    return {
      message: 'Address updated successfully',
      data: updated,
    };
  }

  async delete(id: number) {
    await this.customerAddressRepository.delete(id);
    return {
      message: 'Address deleted successfully',
    };
  }
}
