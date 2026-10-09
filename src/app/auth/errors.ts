import { AppError } from '../../lib/error/AppError';

export const IncorrectCredentialsError = new AppError('Incorrect email or password', 401);
