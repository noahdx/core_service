import { SystemRole } from '../types';

export class UserEntity {
  id: number;
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  systemRole: SystemRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(data: Partial<UserEntity>) {
    this.id = data.id!;
    this.email = data.email!;
    this.phone = data.phone!;
    this.name = data.name!;
    this.passwordHash = data.passwordHash!;
    this.systemRole = data.systemRole!;
    this.createdAt = data.createdAt!;
    this.updatedAt = data.updatedAt!;
    this.deletedAt = data.deletedAt ?? null;
  }
}
