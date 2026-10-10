import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RestaurantStatus } from '../types';
import { Type } from 'class-transformer';

export class CreateRestaurantDTO {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  logoURL?: string;

  @IsString()
  @MinLength(1)
  primaryCountry!: string;
}

export class CreateRestaurantOwnerDTO {
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @IsPhoneNumber()
  phone!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @MinLength(3)
  name!: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    },
    {
      message:
        'Password is not strong enough. It must contain at least 8 characters, one uppercase letter, one lowercase letter, one number.',
    },
  )
  password!: string;
}

export class RegisterRestaurantDTO {
  @ValidateNested()
  @Type(() => CreateRestaurantOwnerDTO)
  owner!: CreateRestaurantOwnerDTO;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  logoURL?: string;

  @IsString()
  @MinLength(1)
  primaryCountry!: string;
}

export class UpdatedRestaurantDTO {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  logoURL?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  primaryCountry?: string;
}

export class UpdateRestaurantStatusDTO {
  @IsNotEmpty()
  @IsEnum(RestaurantStatus)
  status!: RestaurantStatus;
}
