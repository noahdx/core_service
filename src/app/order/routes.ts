import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { rbac, requireBranchAccess } from '../../lib/auth/rbac';
import { container } from '../../lib/di/container';
import { tokens } from '../../lib/di/tokens';
import { idempotency } from '../../lib/idempotency/idempotency';
import { OrderController } from './controller/order.controller';

const orderController = container.resolve<OrderController>(tokens.OrderController);

export const orderRouter = Router();

// 1. Customer Order Operations
orderRouter.post('/orders', authenticate, idempotency({ strict: true }), orderController.placeOrder);
orderRouter.get('/orders/customer', authenticate, orderController.listCustomerOrders);

// 2. Multi-Actor Order Detail & Status (Customer, Agent, Restaurant Member, Admin via Order UUID)
orderRouter.get('/orders/:publicId', authenticate, orderController.getOrder);
orderRouter.patch('/orders/:publicId/status', authenticate, orderController.updateStatus);

// 3. Delivery Agent Operations
orderRouter.post('/orders/agent/release', authenticate, orderController.releaseAssignedOrders);

// 4. Restaurant Branch Orders
orderRouter.get(
  '/branches/:branchId/orders',
  authenticate,
  requireBranchAccess('branchId'),
  rbac({ resource: 'core:order', action: 'read' }),
  orderController.listBranchOrders,
);
