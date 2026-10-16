import { AppError } from '../../lib/error/AppError';

export const OrderNotFoundError = new AppError('Order not found', 404);
export const BranchNotAcceptingOrdersError = new AppError('Branch is currently not accepting orders', 400);
export const OutOfStockError = new AppError('One or more items are out of stock or unavailable', 400);
export const InvalidStatusTransitionError = (from: string, to: string) =>
  new AppError(`Cannot transition order from ${from} to ${to}`, 409);
export const ReasonRequiredError = new AppError('Reason is required for this status change', 400);
export const CancellationWindowExpiredError = new AppError('Order cancellation window has expired', 400);
export const OrderAlreadyAssignedError = new AppError('Order is already assigned to another delivery agent', 409);
export const AddressDoesNotBelongToUserError = new AppError('Address does not belong to authenticated user', 403);
export const RestaurantDoesNotMatchError = new AppError('Order does not belong to this restaurant', 403);
export const EmptyOrderItemsError = new AppError('Order must contain at least one item', 400);
export const OfflineWhilePickedForbiddenError = new AppError('Cannot go offline while holding picked orders in transit', 409);
export const CancelOrderForbiddenError = new AppError('You do not have permission to cancel orders', 403);
