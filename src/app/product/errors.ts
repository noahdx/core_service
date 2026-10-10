import { AppError } from '../../lib/error/AppError';

export const ProductNotFoundError = new AppError('Product not found', 404);
