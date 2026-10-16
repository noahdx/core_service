import { UserEntity } from '../entity/user.entity';
import { SystemRole } from '../types';

export class UserResponseDTO {
  id!: number;
  email!: string;
  phone!: string;
  name!: string;
  systemRole!: SystemRole;
  createdAt!: string;
  updatedAt!: string;

  static from(user: UserEntity): UserResponseDTO {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      systemRole: user.systemRole,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export class UserProfileResponseDTO {
  id!: number;
  email!: string;
  phone!: string;
  systemRole!: SystemRole;

  static from(user: UserEntity): UserProfileResponseDTO {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      systemRole: user.systemRole,
    };
  }
}
