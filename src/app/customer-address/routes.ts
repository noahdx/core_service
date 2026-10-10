import { Router } from 'express';
import { container } from '../../lib/di/container';
import { CustomerAddressController } from './controller/customer-address.controller';
import { tokens } from '../../lib/di/tokens';
import { authenticate } from '../../lib/auth/authenticate';

const addressController = container.resolve<CustomerAddressController>(tokens.CustomerAddressController);

export const addressRouter = Router();
addressRouter.post('/', authenticate, addressController.create);
addressRouter.get('/', authenticate, addressController.getAll);
addressRouter.get('/:addressId', authenticate, addressController.getById);
addressRouter.put('/:addressId', authenticate, addressController.update);
addressRouter.delete('/:addressId', authenticate, addressController.delete);
