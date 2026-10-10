import { MemberStatus } from '../types';

export class RestaurantMemberEntity {
  id: number;
  restaurantId: number;
  userId: number;
  roleId: number;
  status: MemberStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<RestaurantMemberEntity>) {
    this.id = data.id!;
    this.restaurantId = data.restaurantId!;
    this.userId = data.userId!;
    this.roleId = data.roleId!;
    this.status = data.status ?? MemberStatus.ACTIVE;
    this.createdAt = data.createdAt ?? new Date();
    this.updatedAt = data.updatedAt ?? new Date();
  }
}
