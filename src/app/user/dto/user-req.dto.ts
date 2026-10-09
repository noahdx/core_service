import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString, IsStrongPassword, MaxLength, MinLength } from 'class-validator';

export class CreateUserDTO {
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
  @MinLength(3)
  @MaxLength(50)
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
