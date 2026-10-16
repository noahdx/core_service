import { AppError } from '../../lib/error/AppError';

export const PaymentSessionNotFoundError = new AppError('Payment session not found', 404);
export const InvalidOrderStatusForPaymentError = new AppError(
  'Order must be in pending_payment to initiate payment',
  400,
);
export const PaymentAlreadyExistsError = new AppError('Payment already initiated for this order', 409);
export const AmountMismatchError = new AppError('Payment amount does not match order total', 400);
export const RefundExceedsPaidError = new AppError('Refund amount exceeds paid amount', 400);
export const RefundNotAllowedError = new AppError('Refund not allowed for order status', 400);
export const KashierGatewayError = (details: string) => new AppError(`Payment gateway error: ${details}`, 502);
export const InvalidWebhookSignatureError = new AppError('Invalid webhook signature', 401);
export const TransactionNotFoundError = new AppError('Transaction not found', 404);
export const UnauthorizedPaymentAccessError = new AppError('You do not have permission to access this payment', 403);
export const OrderMustBeOnlinePaymentError = new AppError('Order payment method is not online', 400);
