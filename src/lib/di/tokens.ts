export const tokens = {
  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  PasswordRepository: Symbol.for('PasswordRepository'),
  CustomerAddressRepository: Symbol.for('CustomerAddressRepository'),

  // Services
  UserService: Symbol.for('UserService'),
  AuthService: Symbol.for('AuthService'),
  CustomerAddressService: Symbol.for('CustomerAddressService'),

  // Controllers
  UserController: Symbol.for('UserController'),
  AuthController: Symbol.for('AuthController'),
  CustomerAddressController: Symbol.for('CustomerAddressController'),

  // Infrastructure
};
