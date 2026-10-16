import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentMethod } from '../types';

export class OrderItemRequestDTO {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDTO {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerAddressId!: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDTO)
  items!: OrderItemRequestDTO[];
}

export class UpdateOrderStatusDTO {
  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
