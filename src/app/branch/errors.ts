import { AppError } from '../../lib/error/AppError';

export const BranchNotFoundError = new AppError('Branch not found', 404);
