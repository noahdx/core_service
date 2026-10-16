import { Router } from 'express';
import { container } from '../../lib/di/container';
import { tokens } from '../../lib/di/tokens';
import { authenticate } from '../../lib/auth/authenticate';
import { OrderController } from './controller/order.controller';

const orderController = container.resolve<OrderController>(tokens.OrderController);

export const orderRouter = Router();

orderRouter.post('/orders', authenticate, orderController.placeOrder);
orderRouter.get('/orders/customer', authenticate, orderController.listCustomerOrders);
orderRouter.get('/orders/restaurant/:branchId', authenticate, orderController.listBranchOrders);
orderRouter.get('/orders/:publicId', authenticate, orderController.getOrder);
orderRouter.patch('/orders/:publicId/status', authenticate, orderController.updateStatus);
orderRouter.post('/orders/agent/release', authenticate, orderController.releaseAssignedOrders);
