import { AppError } from '../../lib/error/AppError';

export const InsufficientBalanceError = new AppError('Insufficient balance for payout', 409);
export const RestaurantBalanceNotFoundError = new AppError('Restaurant balance not found', 404);
