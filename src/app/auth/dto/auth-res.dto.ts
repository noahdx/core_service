import { SystemRole } from '../../user/types';

export class TokenResponseDTO {
  accessToken!: string;
  refreshToken?: string;
}

export class AuthUserResponseDTO {
  id!: number;
  email!: string;
  name!: string;
  phone?: string;
  role!: SystemRole | string;
  systemRole?: SystemRole;
  restaurantId?: number;
  restaurantRole?: string;
  branchIds?: number[];
}

export class AuthResponseDTO {
  accessToken!: string;
  refreshToken!: string;
  user?: AuthUserResponseDTO;

  static from(data: {
    accessToken: string;
    refreshToken: string;
    user?: {
      id: number;
      email: string;
      name: string;
      phone?: string;
      role?: SystemRole | string;
      systemRole?: SystemRole;
      restaurantId?: number;
      restaurantRole?: string;
      branchIds?: number[];
    };
  }): AuthResponseDTO {
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            phone: data.user.phone,
            role: data.user.role ?? data.user.systemRole ?? '',
            systemRole: data.user.systemRole ?? (data.user.role as SystemRole),
            restaurantId: data.user.restaurantId,
            restaurantRole: data.user.restaurantRole,
            branchIds: data.user.branchIds,
          }
        : undefined,
    };
  }
}

export class AuthMessageResponseDTO {
  message!: string;
}
