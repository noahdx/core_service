import { RestaurantMemberEntity } from '../entity/restaurant-member.entity';
import { RoleEntity } from '../entity/role.entity';
import { PermissionEntity } from '../entity/permission.entity';

export class RoleResponseDTO {
  id!: number;
  name!: string;
  description!: string | null;

  static from(entity: RoleEntity): RoleResponseDTO {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
    };
  }
}

export class PermissionResponseDTO {
  id!: number;
  resource!: string;
  action!: string;

  static from(entity: PermissionEntity): PermissionResponseDTO {
    return {
      id: entity.id,
      resource: entity.resource,
      action: entity.action,
    };
  }
}

export class RestaurantMemberResponseDTO {
  id!: number;
  userId!: number;
  restaurantId!: number;
  roleId!: number;
  status!: string;
  role?: string;
  roleName?: string;
  email?: string;
  name?: string;
  phone?: string;
  branchIds?: number[];
  user?: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  createdAt!: string;
  updatedAt!: string;

  static from(
    entity: RestaurantMemberEntity,
    extra?: {
      roleName?: string;
      branchIds?: number[];
      user?: { id: number; name: string; email: string; phone: string };
    },
  ): RestaurantMemberResponseDTO {
    return {
      id: entity.id,
      userId: entity.userId,
      restaurantId: entity.restaurantId,
      roleId: entity.roleId,
      status: entity.status,
      role: extra?.roleName,
      roleName: extra?.roleName,
      email: extra?.user?.email,
      name: extra?.user?.name,
      phone: extra?.user?.phone,
      branchIds: extra?.branchIds,
      user: extra?.user,
      createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export class RestaurantMemberItemResponseDTO {
  id!: number;
  userId!: number;
  email!: string;
  name!: string;
  phone!: string;
  role!: string;
  roleDisplayName?: string;
  status!: string;

  static from(row: {
    id: number;
    userId: number;
    email: string;
    name: string;
    phone: string;
    role: string;
    roleDisplayName?: string;
    status: string;
  }): RestaurantMemberItemResponseDTO {
    return {
      id: row.id,
      userId: row.userId,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role,
      roleDisplayName: row.roleDisplayName,
      status: row.status,
    };
  }
}

