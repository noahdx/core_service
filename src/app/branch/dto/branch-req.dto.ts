import {
  IsBoolean,
  IsEnum,
  IsISO31661Alpha3,
  IsLatitude,
  IsLongitude,
  IsMilitaryTime,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Currency } from '../types';

export class CreateBranchDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  addressText!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsMilitaryTime()
  opensAt!: string;

  @IsMilitaryTime()
  closesAt!: string;

  @IsNumber()
  @Min(0)
  deliveryRadius!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsISO31661Alpha3()
  countryCode!: string;
}

export class UpdateBranchDTO {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsMilitaryTime()
  opensAt?: string;

  @IsOptional()
  @IsMilitaryTime()
  closesAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadius?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsBoolean()
  acceptOrders?: boolean;
}

export class UpdateBranchStatusDTO {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commission?: number;
}
