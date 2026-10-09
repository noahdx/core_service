import { IsBoolean, IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AddressType } from '../types';

export class CreateAddressDTO {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  building?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apartmentNumber?: string;

  @IsEnum(AddressType)
  type!: AddressType;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsBoolean()
  isDefault!: boolean;
}

export class UpdateAddressDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  building?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apartmentNumber?: string;

  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
