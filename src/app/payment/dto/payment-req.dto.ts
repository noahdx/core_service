import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class InitPaymentDTO {
  @IsOptional()
  @IsString()
  @IsUrl()
  redirectUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

export class RefundRequestDTO {
  @IsNumber()
  @Min(1)
  @Max(99999999)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
