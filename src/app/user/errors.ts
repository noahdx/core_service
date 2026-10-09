import { AppError } from '../../lib/error/AppError';

export const UserAlreadyExistsError = new AppError('User already exists', 400);
export const UserNotFoundError = new AppError('User does not exist', 404);
