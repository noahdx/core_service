import { RestaurantStatus } from '../types';

export class RestaurantEntity {
  id: number;
  ownerId: number;
  name: string;
  status: RestaurantStatus;
  primaryCountry: string;
  logoUrl: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<RestaurantEntity>) {
    this.id = data.id!;
    this.ownerId = data.ownerId!;
    this.name = data.name!;
    this.status = data.status!;
    this.primaryCountry = data.primaryCountry!;
    this.logoUrl = data.logoUrl ?? '';
    this.createdAt = data.createdAt!;
    this.updatedAt = data.updatedAt!;
  }
}
