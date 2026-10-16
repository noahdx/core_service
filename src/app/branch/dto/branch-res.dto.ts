import { BranchEntity } from '../entity/branch.entity';
import { Currency } from '../types';

export class BranchResponseDTO {
  id!: number;
  restaurantId!: number;
  countryCode!: string;
  addressText!: string;
  label!: string;
  lat!: number;
  lng!: number;
  isActive!: boolean;
  opensAt!: string;
  closesAt!: string;
  acceptOrders!: boolean;
  deliveryRadius!: number;
  currency!: Currency;
  commission!: number;
  createdAt!: string;
  updatedAt!: string;

  static from(entity: BranchEntity): BranchResponseDTO {
    return {
      id: entity.id,
      restaurantId: entity.restaurantId,
      countryCode: entity.countryCode,
      addressText: entity.addressText,
      label: entity.label,
      lat: Number(entity.lat),
      lng: Number(entity.lng),
      isActive: Boolean(entity.isActive),
      opensAt: entity.opensAt,
      closesAt: entity.closesAt,
      acceptOrders: Boolean(entity.acceptOrders),
      deliveryRadius: Number(entity.deliveryRadius),
      currency: entity.currency,
      commission: Number(entity.commission),
      createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export class NearBranchResponseDTO {
  id!: number;
  restaurantId!: number;
  addressText!: string;
  label!: string;
  lat!: number;
  lng!: number;
  isActive!: boolean;
  acceptOrders!: boolean;
  currency!: Currency;
  restaurantName!: string;
  logoUrl!: string;

  static from(raw: {
    id: number;
    restaurantId: number;
    addressText: string;
    label: string;
    lat: number;
    lng: number;
    isActive: boolean;
    acceptOrders: boolean;
    currency: Currency;
    restaurantName: string;
    logoUrl: string;
  }): NearBranchResponseDTO {
    return {
      id: raw.id,
      restaurantId: raw.restaurantId,
      addressText: raw.addressText,
      label: raw.label,
      lat: Number(raw.lat),
      lng: Number(raw.lng),
      isActive: Boolean(raw.isActive),
      acceptOrders: Boolean(raw.acceptOrders),
      currency: raw.currency,
      restaurantName: raw.restaurantName,
      logoUrl: raw.logoUrl,
    };
  }
}
