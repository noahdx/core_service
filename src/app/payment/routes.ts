import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { container } from '../../lib/di/container';
import { tokens } from '../../lib/di/tokens';
import { idempotency } from '../../lib/idempotency/idempotency';
import { PaymentController } from './controller/payment.controller';
import { WebhookController } from './controller/webhook.controller';

export const paymentRouter = Router();

const getPaymentController = () => container.resolve<PaymentController>(tokens.PaymentController);
const getWebhookController = () => container.resolve<WebhookController>(tokens.WebhookController);

// Public webhook
paymentRouter.post('/payments/webhook/kashier', (req, res, next) =>
  getWebhookController().handleKashierWebhook(req, res, next),
);

// Order payment initialization & inspection
paymentRouter.post(
  '/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment/init',
  authenticate,
  idempotency(),
  (req, res, next) => getPaymentController().initPayment(req, res, next),
);

paymentRouter.get(
  '/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment',
  authenticate,
  (req, res, next) => getPaymentController().getPayment(req, res, next),
);

// Convenient direct routes
paymentRouter.post(
  '/orders/:orderId/payment/init',
  authenticate,
  idempotency(),
  (req, res, next) => {
    // If restaurantId / branchId omitted, use query or fallback
    req.params.restaurantId = req.params.restaurantId || (req.query.restaurantId as string) || '0';
    req.params.branchId = req.params.branchId || (req.query.branchId as string) || '0';
    return getPaymentController().initPayment(req, res, next);
  },
);

paymentRouter.get(
  '/orders/:orderId/payment',
  authenticate,
  (req, res, next) => {
    req.params.restaurantId = req.params.restaurantId || (req.query.restaurantId as string) || '0';
    req.params.branchId = req.params.branchId || (req.query.branchId as string) || '0';
    return getPaymentController().getPayment(req, res, next);
  },
);

// Refunds (admin / finance / owner)
paymentRouter.post(
  '/payments/:paymentId/refund',
  authenticate,
  idempotency(),
  (req, res, next) => getPaymentController().requestRefund(req, res, next),
);

// List payments for restaurant
paymentRouter.get(
  '/restaurants/:restaurantId/payments',
  authenticate,
  (req, res, next) => getPaymentController().listPayments(req, res, next),
);
