import { OrderStatus, StatusActor } from '../types';
import { CancellationWindowExpiredError, InvalidStatusTransitionError, ReasonRequiredError } from '../errors';

interface TransitionRule {
  actors: StatusActor[];
  stamp: string | null;
  requiresReason?: boolean;
}

const TRANSITIONS: Record<string, Record<string, TransitionRule>> = {
  [OrderStatus.PENDING_PAYMENT]: {
    [OrderStatus.PLACED]: { actors: [StatusActor.SYSTEM], stamp: null },
    [OrderStatus.CANCELLED]: { actors: [StatusActor.CUSTOMER, StatusActor.SYSTEM], stamp: 'cancelled_at' },
  },
  [OrderStatus.PLACED]: {
    [OrderStatus.ACCEPTED]: { actors: [StatusActor.RESTAURANT_MEMBER], stamp: 'accepted_at' },
    [OrderStatus.REJECTED]: { actors: [StatusActor.RESTAURANT_MEMBER], stamp: 'rejected_at', requiresReason: true },
    [OrderStatus.CANCELLED]: {
      actors: [StatusActor.CUSTOMER, StatusActor.RESTAURANT_MEMBER, StatusActor.SYSTEM, StatusActor.ADMIN],
      stamp: 'cancelled_at',
      requiresReason: true,
    },
  },
  [OrderStatus.ACCEPTED]: {
    [OrderStatus.PREPARING]: { actors: [StatusActor.RESTAURANT_MEMBER], stamp: null },
    [OrderStatus.CANCELLED]: {
      actors: [StatusActor.RESTAURANT_MEMBER, StatusActor.ADMIN],
      stamp: 'cancelled_at',
      requiresReason: true,
    },
  },
  [OrderStatus.PREPARING]: {
    [OrderStatus.READY]: { actors: [StatusActor.RESTAURANT_MEMBER], stamp: 'ready_at' },
    [OrderStatus.CANCELLED]: {
      actors: [StatusActor.RESTAURANT_MEMBER, StatusActor.ADMIN],
      stamp: 'cancelled_at',
      requiresReason: true,
    },
  },
  [OrderStatus.READY]: {
    [OrderStatus.ASSIGNED]: { actors: [StatusActor.SYSTEM], stamp: 'assigned_at' },
    [OrderStatus.CANCELLED]: {
      actors: [StatusActor.RESTAURANT_MEMBER, StatusActor.ADMIN],
      stamp: 'cancelled_at',
      requiresReason: true,
    },
  },
  [OrderStatus.ASSIGNED]: {
    [OrderStatus.PICKED]: { actors: [StatusActor.AGENT], stamp: 'picked_at' },
    [OrderStatus.CANCELLED]: { actors: [StatusActor.ADMIN], stamp: 'cancelled_at', requiresReason: true },
  },
  [OrderStatus.PICKED]: {
    [OrderStatus.DELIVERED]: { actors: [StatusActor.AGENT], stamp: 'delivered_at' },
  },
};

const CUSTOMER_CANCEL_WINDOW_MS = 60 * 1000; // 60 seconds

export interface ITransitionContext {
  actor: StatusActor;
  reason?: string;
  createdAt?: Date;
  acceptedAt?: Date | null;
}

export function validateTransition(from: OrderStatus, to: OrderStatus, ctx: ITransitionContext): { stamp: string | null } {
  const allowed = TRANSITIONS[from]?.[to];
  if (!allowed) {
    throw InvalidStatusTransitionError(from, to);
  }

  if (!allowed.actors.includes(ctx.actor)) {
    throw InvalidStatusTransitionError(from, to);
  }

  if (allowed.requiresReason && (!ctx.reason || ctx.reason.trim().length === 0)) {
    throw ReasonRequiredError;
  }

  // Customer cancellation rule
  if (ctx.actor === StatusActor.CUSTOMER && to === OrderStatus.CANCELLED && from === OrderStatus.PLACED) {
    if (ctx.acceptedAt) {
      throw CancellationWindowExpiredError;
    }
    if (ctx.createdAt && Date.now() - ctx.createdAt.getTime() > CUSTOMER_CANCEL_WINDOW_MS) {
      throw CancellationWindowExpiredError;
    }
  }

  return { stamp: allowed.stamp };
}
