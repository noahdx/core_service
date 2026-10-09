import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppError } from '../error/AppError';

export async function validateBody<T extends Object>(cls: new () => T, body: any): Promise<T> {
  const instance = plainToInstance(cls, body);
  const error = await validate(instance, { whitelist: true });

  if (error.length > 0) {
    const messages = error.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new AppError(messages.join('  |  '), 400);
  }

  return instance;
}
