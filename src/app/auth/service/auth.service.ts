import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { UserService } from '../../user/service/user.service';
import { LoginDTO, RegisterDTO } from '../dto/auth-req.dto';
import { SystemRole } from '../../user/types';
import { generateAccessToken, generateRefreshToken, IPayload, verifyPassword } from '../../../lib/utils/common';
import { IncorrectCredentialsError } from '../errors';

@injectable()
export class AuthService {
  constructor(@inject(tokens.UserService) private readonly userService: UserService) {}

  async register(data: RegisterDTO) {
    const user = await this.userService.create({
      email: data.email,
      phone: data.phone,
      name: data.name,
      systemRole: SystemRole.CUSTOMER,
      password: data.password,
    });

    const payload: IPayload = { userId: user.id, email: user.email, systemRole: user.systemRole };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        systemRole: user.systemRole,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginDTO) {
    const user = await this.userService.getByEmail(data.email);
    if (!user) {
      throw IncorrectCredentialsError;
    }

    const match = await verifyPassword(data.password, user.passwordHash);
    if (!match) {
      throw IncorrectCredentialsError;
    }

    const payload: IPayload = { userId: user.id, email: user.email, systemRole: user.systemRole };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        systemRole: user.systemRole,
      },
      accessToken,
      refreshToken,
    };
  }
}
