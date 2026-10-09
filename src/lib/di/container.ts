import { container } from 'tsyringe';
import { tokens } from './tokens';
import { UserRepository } from '../../app/user/repository/user.repository';
import { UserService } from '../../app/user/service/user.service';
import { UserController } from '../../app/user/controller/user.controller';

// Repositories
container.registerSingleton<UserRepository>(tokens.UserRepository, UserRepository);

// Services
container.registerSingleton<UserService>(tokens.UserService, UserService);

// Controllers
container.registerSingleton<UserController>(tokens.UserController, UserController);

// Infrastructure

export { container };
