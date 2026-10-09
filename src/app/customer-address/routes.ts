import { Router } from 'express';
import { container } from '../../lib/di/container';
import { CustomerAddressController } from './controller/customer-address.controller';
import { tokens } from '../../lib/di/tokens';
import { authenticate } from '../../lib/auth/authenticate';

const addressController = container.resolve<CustomerAddressController>(tokens.CustomerAddressController);

export const addressRouter = Router();
addressRouter.get('/:userId', authenticate, addressController.getAll);
addressRouter.get('/:id', authenticate, addressController.getById);
addressRouter.put('/:id', authenticate, addressController.update);
addressRouter.post('/', authenticate, addressController.create);
addressRouter.delete('/:id', authenticate, addressController.delete);
