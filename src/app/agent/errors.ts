import { AppError } from '../../lib/error/AppError';

export const CannotGoOfflineWithPickedOrder = new AppError('Cannot go offline while having picked orders', 409);
export const OrderAlreadyClaimedError = new AppError('Order has already been claimed by another agent', 409);
export const OfferExpiredError = new AppError('Order offer has expired or is not available', 409);
export const InvalidAgentStatusTransition = new AppError('Invalid agent status transition', 409);
export const AgentNotAssignedToOrder = new AppError('Agent is not assigned to this order', 403);
export const OrderNotReadyForAssignment = new AppError('Order is not ready for assignment', 409);
export const AgentNotFoundError = new AppError('Agent not found', 404);
export const AgentOfflineError = new AppError('Agent is currently offline', 400);
