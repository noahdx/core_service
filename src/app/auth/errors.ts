import { AppError } from '../../lib/error/AppError';

export const IncorrectCredentialsError = new AppError('Incorrect email or password', 401);
export const InvalidOTPError = new AppError('Invalid OTP', 400);
export const RestaurantDataRequiredError = new AppError('Restaurant data is required', 400);
