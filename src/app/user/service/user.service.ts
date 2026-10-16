import { inject, injectable } from 'tsyringe';
import { UserRepository } from '../repository/user.repository';
import { tokens } from '../../../lib/di/tokens';
import { Knex } from 'knex';
import { UserAlreadyExistsError, UserNotFoundError } from '../errors';
import { hashPassword } from '../../../lib/utils/common';
import { ICreateUserData } from '../types';
import { UpdateUserDTO } from '../dto/user-req.dto';
import { UserProfileResponseDTO } from '../dto/user-res.dto';

@injectable()
export class UserService {
  constructor(@inject(tokens.UserRepository) private readonly userRepository: UserRepository) {}

  async getById(id: number) {
    return await this.userRepository.findById(id);
  }

  async getByEmail(email: string) {
    return await this.userRepository.findByEmail(email);
  }

  async existsByEmail(email: string) {
    return await this.userRepository.existsByEmail(email);
  }

  async getProfile(id: number) {
    const user = await this.getById(id);
    if (!user) {
      throw UserNotFoundError;
    }

    return {
      message: 'User retrieved successfully',
      data: UserProfileResponseDTO.from(user),
    };
  }

  async create(data: ICreateUserData, trx?: Knex) {
    const existing = await this.existsByEmail(data.email);
    if (existing) {
      throw UserAlreadyExistsError;
    }

    const hashedPassword = await hashPassword(data.password);
    const date = new Date();

    return await this.userRepository.create(
      {
        email: data.email,
        phone: data.phone,
        name: data.name,
        systemRole: data.systemRole,
        passwordHash: hashedPassword,
        createdAt: date,
        updatedAt: date,
      },
      trx,
    );
  }

  async update(id: number, data: UpdateUserDTO, trx?: Knex) {
    const user = await this.getById(id);
    if (!user) {
      throw UserNotFoundError;
    }

    const updated = await this.userRepository.update(id, data);

    return {
      message: 'User updated successfully',
      data: UserProfileResponseDTO.from(updated),
    };
  }

  async updatePassword(id: number, password: string) {
    const hashedPassword = await hashPassword(password);
    await this.userRepository.updatePassword(id, hashedPassword);
  }
}
