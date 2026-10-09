import { container } from 'tsyringe';
import { tokens } from './tokens';
import { UserRepository } from '../../app/user/repository/user.repository';

// Repositories
container.registerSingleton<UserRepository>(tokens.UserRepository, UserRepository);

// Services

// Controllers

// Infrastructure

export { container };
