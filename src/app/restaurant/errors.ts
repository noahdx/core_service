import { AppError } from '../../lib/error/AppError';

export const RestaurantNotFoundError = new AppError('Restaurant not found', 404);
