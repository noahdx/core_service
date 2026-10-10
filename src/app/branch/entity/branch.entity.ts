import { Currency } from '../types';

export class BranchEntity {
  id: number;
  restaurantId: number;
  countryCode: string;
  addressText: string;
  label: string;
  lng: number;
  lat: number;
  isActive: boolean;
  opensAt: string;
  closesAt: string;
  acceptOrders: boolean;
  deliveryRadius: number; // km
  currency: Currency;
  commission: number;
  createdAt: Date;
  updatedAt: Date;
  location?: String;

  constructor(data: Partial<BranchEntity>) {
    this.id = data.id!;
    this.restaurantId = data.restaurantId!;
    this.countryCode = data.countryCode!;
    this.addressText = data.addressText!;
    this.label = data.label!;
    this.lat = data.lat!;
    this.lng = data.lng!;
    this.isActive = data.isActive!;
    this.opensAt = data.opensAt!;
    this.closesAt = data.closesAt!;
    this.acceptOrders = data.acceptOrders!;
    this.createdAt = data.createdAt ?? new Date();
    this.updatedAt = data.updatedAt ?? new Date();
    this.deliveryRadius = data.deliveryRadius ?? 0;
    this.currency = data.currency!;
    this.commission = data.commission ?? 0;
  }
}
