import { CustomerAddressEntity } from '../entity/customer-address.entity';
import { AddressType } from '../types';

export class CustomerAddressResponseDTO {
  id!: number;
  userId!: number;
  label!: string;
  lng!: number;
  lat!: number;
  isDefault!: boolean;
  country!: string;
  city!: string;
  street!: string;
  type!: AddressType;
  building!: string | null;
  apartmentNumber!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static from(entity: CustomerAddressEntity): CustomerAddressResponseDTO {
    return {
      id: entity.id,
      userId: entity.userId,
      label: entity.label,
      lng: Number(entity.lng),
      lat: Number(entity.lat),
      isDefault: Boolean(entity.isDefault),
      country: entity.country,
      city: entity.city,
      street: entity.street,
      type: entity.type,
      building: entity.building ?? null,
      apartmentNumber: entity.apartmentNumber ?? null,
      createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
