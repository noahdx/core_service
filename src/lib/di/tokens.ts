export const tokens = {
  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  PasswordRepository: Symbol.for('PasswordRepository'),
  CustomerAddressRepository: Symbol.for('CustomerAddressRepository'),
  RestaurantRepository: Symbol.for('RestaurantRepository'),
  BranchRepository: Symbol.for('BranchRepository'),
  ProductRepository: Symbol.for('ProductRepository'),
  ProductCategoryRepository: Symbol.for('ProductCategoryRepository'),
  PBDRepository: Symbol.for('PBDRepository'),

  // Services
  UserService: Symbol.for('UserService'),
  AuthService: Symbol.for('AuthService'),
  CustomerAddressService: Symbol.for('CustomerAddressService'),
  RestaurantService: Symbol.for('RestaurantService'),
  BranchService: Symbol.for('BranchService'),
  ProductService: Symbol.for('ProductService'),

  // Controllers
  UserController: Symbol.for('UserController'),
  AuthController: Symbol.for('AuthController'),
  CustomerAddressController: Symbol.for('CustomerAddressController'),
  RestaurantController: Symbol.for('RestaurantController'),
  BranchController: Symbol.for('BranchController'),
  ProductController: Symbol.for('ProductController'),

  // Infrastructure
};
