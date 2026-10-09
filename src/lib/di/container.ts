import { container } from 'tsyringe';
import { tokens } from './tokens';
import { UserRepository } from '../../app/user/repository/user.repository';
import { PasswordResetRepository } from '../../app/auth/repository/password-reset.repository';
import { UserService } from '../../app/user/service/user.service';
import { UserController } from '../../app/user/controller/user.controller';
import { AuthService } from '../../app/auth/service/auth.service';
import { AuthController } from '../../app/auth/controller/auth.controller';

// Repositories
container.registerSingleton<UserRepository>(tokens.UserRepository, UserRepository);
container.registerSingleton<PasswordResetRepository>(tokens.PasswordRepository, PasswordResetRepository);

// Services
container.registerSingleton<UserService>(tokens.UserService, UserService);
container.registerSingleton<AuthService>(tokens.AuthService, AuthService);

// Controllers
container.registerSingleton<UserController>(tokens.UserController, UserController);
container.registerSingleton<AuthController>(tokens.AuthController, AuthController);

// Infrastructure

export { container };
