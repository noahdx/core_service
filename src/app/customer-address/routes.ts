import { Router } from 'express';
import { container } from '../../lib/di/container';
import { CustomerAddressController } from './controller/customer-address.controller';
import { tokens } from '../../lib/di/tokens';

const addressController = container.resolve<CustomerAddressController>(tokens.CustomerAddressController);

export const addressRouter = Router();
addressRouter.get('/:userId', addressController.getAll);
addressRouter.get('/:id', addressController.getById);
addressRouter.put('/:id', addressController.update);
addressRouter.post('/', addressController.create);
addressRouter.delete('/:id', addressController.delete);
