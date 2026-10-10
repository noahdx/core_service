import { container } from 'tsyringe';
import { tokens } from './tokens';
import { UserRepository } from '../../app/user/repository/user.repository';
import { PasswordResetRepository } from '../../app/auth/repository/password-reset.repository';
import { UserService } from '../../app/user/service/user.service';
import { UserController } from '../../app/user/controller/user.controller';
import { AuthService } from '../../app/auth/service/auth.service';
import { AuthController } from '../../app/auth/controller/auth.controller';
import { CustomerAddressRepository } from '../../app/customer-address/repository/customer-address.repository';
import { CustomerAddressService } from '../../app/customer-address/service/customer-address.service';
import { CustomerAddressController } from '../../app/customer-address/controller/customer-address.controller';
import { RestaurantRepository } from '../../app/restaurant/repository/restaurant.repository';
import { RestaurantService } from '../../app/restaurant/service/restaurant.service';
import { RestaurantController } from '../../app/restaurant/controller/restaurant.controller';
import { BranchRepository } from '../../app/branch/repository/branch.repository';
import { BranchService } from '../../app/branch/service/branch.service';
import { BranchController } from '../../app/branch/controller/branch.controller';

// Repositories
container.registerSingleton<UserRepository>(tokens.UserRepository, UserRepository);
container.registerSingleton<PasswordResetRepository>(tokens.PasswordRepository, PasswordResetRepository);
container.registerSingleton<CustomerAddressRepository>(tokens.CustomerAddressRepository, CustomerAddressRepository);
container.registerSingleton<RestaurantRepository>(tokens.RestaurantRepository, RestaurantRepository);
container.registerSingleton<BranchRepository>(tokens.BranchRepository, BranchRepository);

// Services
container.registerSingleton<UserService>(tokens.UserService, UserService);
container.registerSingleton<AuthService>(tokens.AuthService, AuthService);
container.registerSingleton<CustomerAddressService>(tokens.CustomerAddressService, CustomerAddressService);
container.registerSingleton<RestaurantService>(tokens.RestaurantService, RestaurantService);
container.registerSingleton<BranchService>(tokens.BranchService, BranchService);

// Controllers
container.registerSingleton<UserController>(tokens.UserController, UserController);
container.registerSingleton<AuthController>(tokens.AuthController, AuthController);
container.registerSingleton<CustomerAddressController>(tokens.CustomerAddressController, CustomerAddressController);
container.registerSingleton<RestaurantController>(tokens.RestaurantController, RestaurantController);
container.registerSingleton<BranchController>(tokens.BranchController, BranchController);

// Infrastructure

export { container };
