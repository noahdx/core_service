import { container } from 'tsyringe';
import { AuthController } from '../../app/auth/controller/auth.controller';
import { PasswordResetRepository } from '../../app/auth/repository/password-reset.repository';
import { AuthService } from '../../app/auth/service/auth.service';
import { BranchController } from '../../app/branch/controller/branch.controller';
import { BranchRepository } from '../../app/branch/repository/branch.repository';
import { BranchService } from '../../app/branch/service/branch.service';
import { CustomerAddressController } from '../../app/customer-address/controller/customer-address.controller';
import { CustomerAddressRepository } from '../../app/customer-address/repository/customer-address.repository';
import { CustomerAddressService } from '../../app/customer-address/service/customer-address.service';
import { ProductController } from '../../app/product/controller/product.controller';
import { CategoryRepository } from '../../app/product/repository/category.repository';
import { ProductBranchDetailsRepository } from '../../app/product/repository/product-branch-details.repository';
import { ProductRepository } from '../../app/product/repository/product.repository';
import { ProductService } from '../../app/product/service/product.service';
import { MemberController } from '../../app/rbac/controller/member.controller';
import { MemberBranchRepository } from '../../app/rbac/repository/member-branch.repository';
import { PermissionRepository } from '../../app/rbac/repository/permission.repository';
import { RestaurantMemberRepository } from '../../app/rbac/repository/restaurant_member.repository';
import { RoleRepository } from '../../app/rbac/repository/role.repository';
import { MemberInternalService } from '../../app/rbac/service/member-internal.service';
import { MemberService } from '../../app/rbac/service/member.service';
import { PermissionCacheService } from '../../app/rbac/service/permission-cache.service';
import { RestaurantController } from '../../app/restaurant/controller/restaurant.controller';
import { RestaurantRepository } from '../../app/restaurant/repository/restaurant.repository';
import { RestaurantService } from '../../app/restaurant/service/restaurant.service';
import { UserController } from '../../app/user/controller/user.controller';
import { UserRepository } from '../../app/user/repository/user.repository';
import { UserService } from '../../app/user/service/user.service';
import { OrderController } from '../../app/order/controller/order.controller';
import { OrderRepository } from '../../app/order/repository/order.repository';
import { OrderItemRepository } from '../../app/order/repository/order-item.repository';
import { OrderService } from '../../app/order/service/order.service';
import { cacheProvider } from '../cache/init';
import { emailProvider } from '../email/init';
import { tokens } from './tokens';

// Repositories
container.registerSingleton<UserRepository>(tokens.UserRepository, UserRepository);
container.registerSingleton<PasswordResetRepository>(tokens.PasswordRepository, PasswordResetRepository);
container.registerSingleton<CustomerAddressRepository>(tokens.CustomerAddressRepository, CustomerAddressRepository);
container.registerSingleton<RestaurantRepository>(tokens.RestaurantRepository, RestaurantRepository);
container.registerSingleton<BranchRepository>(tokens.BranchRepository, BranchRepository);
container.registerSingleton<ProductRepository>(tokens.ProductRepository, ProductRepository);
container.registerSingleton<CategoryRepository>(tokens.ProductCategoryRepository, CategoryRepository);
container.registerSingleton<ProductBranchDetailsRepository>(tokens.PBDRepository, ProductBranchDetailsRepository);
container.registerSingleton<RoleRepository>(tokens.RoleRepository, RoleRepository);
container.registerSingleton<PermissionRepository>(tokens.PermissionRepository, PermissionRepository);
container.registerSingleton<RestaurantMemberRepository>(tokens.RestaurantMemberRepository, RestaurantMemberRepository);
container.registerSingleton<MemberBranchRepository>(tokens.MemberBranchRepository, MemberBranchRepository);
container.registerSingleton<OrderRepository>(tokens.OrderRepository, OrderRepository);
container.registerSingleton<OrderItemRepository>(tokens.OrderItemRepository, OrderItemRepository);

// Services
container.registerSingleton<UserService>(tokens.UserService, UserService);
container.registerSingleton<AuthService>(tokens.AuthService, AuthService);
container.registerSingleton<CustomerAddressService>(tokens.CustomerAddressService, CustomerAddressService);
container.registerSingleton<RestaurantService>(tokens.RestaurantService, RestaurantService);
container.registerSingleton<BranchService>(tokens.BranchService, BranchService);
container.registerSingleton<ProductService>(tokens.ProductService, ProductService);
container.registerSingleton<MemberService>(tokens.MemberService, MemberService);
container.registerSingleton<PermissionCacheService>(tokens.PermissionCacheService, PermissionCacheService);
container.registerSingleton<MemberInternalService>(tokens.MemberInternalService, MemberInternalService);
container.registerSingleton<OrderService>(tokens.OrderService, OrderService);

// Controllers
container.registerSingleton<UserController>(tokens.UserController, UserController);
container.registerSingleton<AuthController>(tokens.AuthController, AuthController);
container.registerSingleton<CustomerAddressController>(tokens.CustomerAddressController, CustomerAddressController);
container.registerSingleton<RestaurantController>(tokens.RestaurantController, RestaurantController);
container.registerSingleton<BranchController>(tokens.BranchController, BranchController);
container.registerSingleton<ProductController>(tokens.ProductController, ProductController);
container.registerSingleton<MemberController>(tokens.MemberController, MemberController);
container.registerSingleton<OrderController>(tokens.OrderController, OrderController);

// Infrastructure
container.registerInstance(tokens.CacheProvider, cacheProvider);
container.registerInstance(tokens.EmailProvider, emailProvider);
export { container };
