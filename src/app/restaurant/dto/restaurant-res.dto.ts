import { RestaurantEntity } from '../entity/restaurant.entity';
import { RestaurantStatus } from '../types';

export class RestaurantResponseDTO {
  id!: number;
  ownerId!: number;
  name!: string;
  status!: RestaurantStatus;
  primaryCountry!: string;
  logoUrl!: string;
  createdAt!: string;
  updatedAt!: string;

  static from(entity: RestaurantEntity): RestaurantResponseDTO {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      name: entity.name,
      status: entity.status,
      primaryCountry: entity.primaryCountry,
      logoUrl: entity.logoUrl,
      createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
