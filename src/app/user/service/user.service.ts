import { inject, injectable } from 'tsyringe';
import { UserRepository } from '../repository/user.repository';
import { tokens } from '../../../lib/di/tokens';
import { Knex } from 'knex';
import { UserAlreadyExistsError, UserNotFoundError } from '../errors';
import { hashPassword } from '../../../lib/utils/common';
import { ICreateUserData } from '../types';
import { UpdateUserDTO } from '../dto/user-req.dto';

@injectable()
export class UserService {
  constructor(@inject(tokens.UserRepository) private readonly userRepository: UserRepository) {}

  async getById(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw UserNotFoundError;
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      systemRole: user.systemRole,
    };
  }

  async getByEmail(email: string) {
    return await this.userRepository.findByEmail(email);
  }

  async existsByEmail(email: string) {
    return await this.userRepository.existsByEmail(email);
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
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      systemRole: updated.systemRole,
    };
  }
}
