export enum SystemRole {
  CUSTOMER = 'customer',
  RESTAURANT_USER = 'restaurant_user',
  DELIVERY_AGENT = 'delivery_agent',
  SYSTEM_ADMIN = 'system_admin',
}

export interface ICreateUserData {
  email: string;
  phone: string;
  name: string;
  systemRole: SystemRole;
  password: string;
}
