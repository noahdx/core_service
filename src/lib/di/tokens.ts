export const tokens = {
  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  PasswordRepository: Symbol.for('PasswordRepository'),
  CustomerAddressRepository: Symbol.for('CustomerAddressRepository'),
  RestaurantRepository: Symbol.for('RestaurantRepository'),

  // Services
  UserService: Symbol.for('UserService'),
  AuthService: Symbol.for('AuthService'),
  CustomerAddressService: Symbol.for('CustomerAddressService'),
  RestaurantService: Symbol.for('RestaurantService'),

  // Controllers
  UserController: Symbol.for('UserController'),
  AuthController: Symbol.for('AuthController'),
  CustomerAddressController: Symbol.for('CustomerAddressController'),
  RestaurantController: Symbol.for('RestaurantController'),

  // Infrastructure
};
