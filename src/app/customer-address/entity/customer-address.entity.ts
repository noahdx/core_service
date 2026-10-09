import { AddressType } from '../types';

export class CustomerAddressEntity {
  id: number;
  userId: number;
  label: string;
  lng: number;
  lat: number;
  isDefault: boolean;
  country: string;
  city: string;
  street: string;
  type: AddressType;
  building: string | null;
  apartmentNumber: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<CustomerAddressEntity>) {
    this.id = data.id!;
    this.userId = data.userId!;
    this.label = data.label!;
    this.lng = data.lng!;
    this.lat = data.lat!;
    this.isDefault = data.isDefault!;
    this.country = data.country!;
    this.city = data.city!;
    this.street = data.street!;
    this.type = data.type!;
    this.building = data.building ?? null;
    this.apartmentNumber = data.apartmentNumber ?? null;
    this.createdAt = data.createdAt!;
    this.updatedAt = data.updatedAt!;
  }
}
