import { IsNotEmpty, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDTO {
  @IsNotEmpty()
  @IsString()
  @IsPhoneNumber()
  phone!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name!: string;
}
