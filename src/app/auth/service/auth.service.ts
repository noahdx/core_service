import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { UserService } from '../../user/service/user.service';
import { ForgetPasswordDTO, LoginDTO, RegisterDTO, ResetPasswordDTO } from '../dto/auth-req.dto';
import { SystemRole } from '../../user/types';
import {
  generateAccessToken,
  generateOTP,
  generateRefreshToken,
  hashOTP,
  JwtPayload,
  verifyPassword,
  verifyRefreshToken,
} from '../../../lib/utils/common';
import { IncorrectCredentialsError, InvalidOTPError, RestaurantDataRequiredError } from '../errors';
import { PasswordResetRepository } from '../repository/password-reset.repository';
import { toMs } from '../../../pkg/utils/time';
import { logger } from '../../../lib/logger/logger';
import { RestaurantService } from '../../restaurant/service/restaurant.service';
import { db } from '../../../lib/knex/knex';

@injectable()
export class AuthService {
  constructor(
    @inject(tokens.UserService) private readonly userService: UserService,
    @inject(tokens.PasswordRepository) private readonly passwordResetRepository: PasswordResetRepository,
    @inject(tokens.RestaurantService) private readonly restaurantService: RestaurantService,
  ) {}

  async register(data: RegisterDTO) {
    let user;
    let restaurant;
    let restaurantMemberInfo: { restaurantId?: number; restaurantRole?: string; branchIds?: number[] } = {};
    const trx = await db.transaction();

    try {
      user = await this.userService.create(
        {
          email: data.email,
          phone: data.phone,
          name: data.name,
          systemRole: SystemRole.CUSTOMER,
          password: data.password,
        },
        trx,
      );

      // check if the type of user is restaurant, then call restaurant service to create a new restaurant
      if (data.role === SystemRole.RESTAURANT_USER) {
        if (data.restaurant == undefined) {
          throw RestaurantDataRequiredError;
        }

        restaurant = await this.restaurantService.create(user.id, data.restaurant, trx);
        restaurantMemberInfo = {
          restaurantId: restaurant.id,
          restaurantRole: 'owner',
          branchIds: [],
        };
      }

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }

    const payload = { userId: user.id, email: user.email, role: user.systemRole, ...restaurantMemberInfo };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.systemRole,
        createdAt: user.createdAt,
      },
      restaurant,
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

    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.systemRole };
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

  async forgetPassword(data: ForgetPasswordDTO) {
    const user = await this.userService.getByEmail(data.email);
    if (!user) {
      return { message: 'Email Sent with OTP' };
    }

    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    const date = new Date();

    await this.passwordResetRepository.create({
      userId: user.id,
      otpHash: hashedOTP,
      createdAt: date,
      expiresAt: new Date(Date.now() + toMs(10, 'm')),
    });

    // send password to user
    logger.info(`OTP: ${otp}`);
  }

  async resetPassword(data: ResetPasswordDTO) {
    const user = await this.userService.getByEmail(data.email);
    if (!user) {
      throw InvalidOTPError;
    }

    const reset = await this.passwordResetRepository.findLatestPasswordResetByUserId(user.id);
    if (!reset) {
      throw InvalidOTPError;
    }

    const hashedOTP = hashOTP(data.otp);

    if (hashedOTP !== reset.otpHash || reset.isExpired()) {
      throw InvalidOTPError;
    }

    await this.userService.updatePassword(user.id, data.newPassword);
    await this.passwordResetRepository.markAsConsumed(user.id);

    return { message: 'Password reset successfully' };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw IncorrectCredentialsError;
    }

    const payload = verifyRefreshToken(refreshToken);

    const accessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    return { accessToken };
  }
}
