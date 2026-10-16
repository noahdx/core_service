# Business Logic — Agents & Deliveries

## Overview

Delivery state lives on the `orders` table (no separate `deliveries` table). Agent presence is Redis-only (5-min TTL).

### Order Delivery Fields

| Field                                                 | Purpose                                             |
| ----------------------------------------------------- | --------------------------------------------------- |
| `agent_id`                                            | Current assignee (FK to users, delivery_agent role) |
| `status` ∈ `{assigned, picked, delivered, cancelled}` | Delivery phase                                      |
| `assigned_at`                                         | Assignment moment                                   |
| `picked_at`                                           | Agent picked up from branch                         |
| `delivered_at`                                        | Agent dropped at customer                           |
| `delivery_lat/lng/address_text_snapshot`              | Drop-off coordinates (snapshotted)                  |

---

## Agent Presence (Redis)

### Keys

| Key                         | Type    | TTL  | Written By                               |
| --------------------------- | ------- | ---- | ---------------------------------------- |
| `presence:meta:<agentId>`   | hash    | 300s | `presence.service` on online/ping        |
| `presence:geo`              | geo set | none | `presence.service` on ping               |
| `presence:busy`             | set     | none | `assignment.service` on claim/settlement |
| `offer:order:<orderId>`     | string  | 30s  | `assignment.service` on broadcast        |
| `claim:order:<orderId>`     | string  | 5min | `agent.service` on accept                |
| `assign:attempts:<orderId>` | string  | 1h   | `assignment.service` per broadcast       |

### Lifecycle

1. **Agent comes online**: `POST /api/agents/presence/online` → `HSET meta`, `GEOADD geo`, `EXPIRE 300`
2. **Agent pings location**: `POST /api/agents/presence/ping` (every 30s) → refresh `meta` TTL, update `geo`
3. **Agent gets assigned**: `SADD busy`, `SET claim:order:<id> <agentId> NX`
4. **Order delivered**: `SREM busy`, `DEL claim:order:<id>`, `DEL offer:order:<id>`
5. **Agent goes offline**: `POST /api/agents/presence/offline` → `DEL meta`, `ZREM geo`, `SREM busy` (reject if agent has `picked` order)

### Invariants

- `presence:meta:*` TTL = freshness cutoff. If key gone → agent offline.
- `presence:geo` may have stale entries; assignment scan filters by `EXISTS presence:meta:*`.
- `presence:busy` ⇔ agent has order with `status IN ('assigned','picked')`.
- Going offline with `picked` order → **rejected** (would orphan in-flight food).

---

## Auto-Assignment Algorithm

### Trigger

- Order status → `ready` (restaurant marks ready)
- Assignment worker tick (every 10s, `ASSIGNMENT_TICK_SEC`)

### Assignment Worker (Background)

```typescript
// Runs every ASSIGNMENT_TICK_SEC (default 10s) per region
async function assignmentTick() {
  const readyOrders = await orderRepo.findReadyUnassigned((BATCH_SIZE = 20));
  for (const order of readyOrders) {
    await tryAssign(order);
  }
}
```

### tryAssign(order)

```typescript
async function tryAssign(order) {
  // 1. Skip if offer already pending
  const existingOffer = await redis.get(`offer:order:${order.id}`);
  if (existingOffer) return;

  // 2. Skip if attempts exceeded
  const attempts = await redis.get(`assign:attempts:${order.id}`);
  if (attempts >= MAX_REASSIGNMENT_ATTEMPTS) {
    await ws.publishAdminAlert({ orderId: order.publicId, reason: 'max_attempts' });
    return;
  }

  // 3. Find candidates: GEOSEARCH near branch + online + not busy
  const branch = await branchClient.getBranch(order.branch_id); // cached
  const candidates = await redis.geosearch(
    'presence:geo',
    branch.lat,
    branch.lng,
    ASSIGNMENT_RADIUS_METERS, // default 5000
    { count: 5, withCoord: true },
  );

  // Filter: EXISTS presence:meta:* AND NOT IN presence:busy
  const available = [];
  for (const c of candidates) {
    const isOnline = await redis.exists(`presence:meta:${c.id}`);
    const isBusy = await redis.sismember('presence:busy', c.id);
    if (isOnline && !isBusy) available.push(c);
  }

  if (available.length === 0) return; // no one available, retry next tick

  // 4. Create offer
  const candidateIds = available.map((c) => c.id).join(',');
  await redis.set(`offer:order:${order.id}`, candidateIds, 'EX', 30, 'NX');
  await redis.incr(`assign:attempts:${order.id}`);

  // 5. Publish WS to each candidate
  for (const agentId of available.map((c) => c.id)) {
    await ws.publishToAgent(agentId, 'task.offered', {
      orderId: order.publicId,
      branch: { id: branch.id, name: branch.name, lat: branch.lat, lng: branch.lng },
      customer: { lat: order.delivery_lat, lng: order.delivery_lng, address: order.delivery_address_text_snapshot },
      expiresAt: Date.now() + 30000,
    });
  }
}
```

---

## Agent Actions

### Accept Offer

```
POST /api/agents/orders/:publicId/accept
```

```typescript
async function acceptOrder(publicId, agentId) {
  // 1. Atomic claim
  const claimed = await redis.set(`claim:order:${publicId}`, agentId, 'NX', 'EX', 300);
  if (!claimed) throw new AppError('Order already claimed', 409);

  // 2. Update order in DB (conditional update)
  const updated = await orderRepo.claimOrder(publicId, agentId); // WHERE status='ready' AND agent_id IS NULL
  if (!updated) {
    await redis.del(`claim:order:${publicId}`);
    throw new AppError('Order no longer available', 409);
  }

  // 3. Mark agent busy
  await redis.sadd('presence:busy', agentId);

  // 4. Notify losers + customer + branch
  const offer = await redis.get(`offer:order:${publicId}`);
  const candidateIds = offer?.split(',').map(Number) || [];
  for (const cid of candidateIds) {
    if (cid !== agentId) {
      await ws.publishToAgent(cid, 'offer.cancelled', { orderId: publicId, reason: 'claimed_by_other' });
    }
  }
  await ws.publishToBranch(order.branch_id, 'delivery.assigned', { orderId: publicId, agentId });
  await ws.publishToCustomer(order.customer_id, 'order.status_changed', { status: 'assigned' });
}
```

### Reject Offer

```
POST /api/agents/orders/:publicId/reject
```

```typescript
async function rejectOrder(publicId, agentId) {
  // Remove from offer candidates
  const offer = await redis.get(`offer:order:${publicId}`);
  if (offer) {
    const candidates = offer
      .split(',')
      .map(Number)
      .filter((id) => id !== agentId);
    await redis.set(`offer:order:${publicId}`, candidates.join(','), 'XX', 'EX', 30);
  }
  // No DB write, just bump attempts counter for this agent
  // Worker will re-broadcast on next tick if candidates remain
}
```

### Transition Status (Agent)

```
PATCH /api/agents/orders/:publicId/status { status: 'picked' | 'delivered' }
```

```typescript
async function agentTransitionStatus(publicId, agentId, newStatus) {
  const order = await orderRepo.findByPublicId(publicId);
  assertOrderBelongsToAgent(order, agentId);
  assertValidAgentTransition(order.status, newStatus);

  await orderService.updateStatus(order.id, newStatus, agentId, 'agent');

  // WS events published by orderService after commit
}
```

### Valid Agent Transitions

| From → To              | Condition                                                        |
| ---------------------- | ---------------------------------------------------------------- |
| `assigned` → `picked`  | Agent at branch location (validated by proximity check optional) |
| `picked` → `delivered` | Agent at customer location                                       |
| `assigned` → `ready`   | Agent went offline / timeout (system action, not agent)          |

---

## Settlement (on DELIVERED)

Runs in same transaction as `orders.status = 'delivered'`:

```typescript
async function settleOrder(order, trx) {
  // 1. COD: mark collection succeeded
  if (order.payment_method === 'cod') {
    await transactionRepo.updateCODCollection(order.id, 'succeeded', trx);
  }

  // 2. Commission (Phase 4+)
  const branch = await branchClient.getBranch(order.branch_id);
  const commission = Math.floor((order.subtotal * branch.commission_bps) / 10000);
  await orderRepo.updateCommission(order.id, commission, trx);

  if (commission > 0) {
    await transactionRepo.insert(
      {
        order_id: order.id,
        transaction_type: 'commission',
        method: 'system',
        status: 'succeeded',
        amount: commission,
        currency: order.currency,
        src_acc_id: order.restaurant_owner_id, // restaurant pays commission
        dst_acc_id: null, // platform receives
        idempotency_key: `commission:${order.public_id}`,
      },
      trx,
    );
  }

  // 3. Restaurant balance: + (subtotal - commission)
  const netToRestaurant = order.subtotal - commission;
  await restaurantBalanceRepo.upsertIncrement(
    {
      restaurant_id: order.restaurant_id,
      currency: order.currency,
      delta: netToRestaurant,
    },
    trx,
  );

  // 4. Agent earnings: floor(delivery_fee * AGENT_EARNING_SHARE_BPS / 10000)
  const agentEarning = Math.floor((order.delivery_fee * AGENT_EARNING_SHARE_BPS) / 10000);
  await agentEarningRepo.insert(
    {
      agent_id: order.agent_id,
      order_id: order.id,
      amount: agentEarning,
      currency: order.currency,
    },
    trx,
  ); // unique on order_id makes this idempotent

  // 5. After commit: Redis cleanup
  await redis.srem('presence:busy', order.agent_id);
  await redis.del(`claim:order:${order.id}`);
  await redis.del(`offer:order:${order.id}`);
}
```

---

## Admin Override Assignment

```
POST /api/admin/orders/:publicId/assign { agentId }
```

- Bypasses distance/busy checks
- Directly claims order for specified agent
- Used when auto-assignment fails after `MAX_REASSIGNMENT_ATTEMPTS`

---

## Agent Earnings

```
GET /api/agents/earnings?from=2026-01-01&to=2026-01-31
```

- Queries `agent_earnings` table (indexed by `agent_id, earned_at DESC`)
- Returns `AgentEarningsResponseDTO[]` with pagination
- Sum endpoint: `GET /api/agents/earnings/sum?from=&to=`

---

## Agent Tasks

```
GET /api/agents/tasks?status=assigned,picked
```

- Queries `orders` where `agent_id = ? AND status IN (?)`
- Uses `idx_orders_agent_id_status`
- Returns `DeliveryTaskResponseDTO[]` (trimmed order view for courier app)

---

## WebSocket Events

| Channel                     | Event                  | Payload                                    |
| --------------------------- | ---------------------- | ------------------------------------------ |
| `customer:<userId>`         | `order.status_changed` | { orderId, status, agent?: {name, phone} } |
| `customer:<userId>`         | `delivery.position`    | { orderId, lat, lng, timestamp }           |
| `branch:<branchId>`         | `order.placed`         | { orderId, items[], customer }             |
| `branch:<branchId>`         | `order.status_changed` | { orderId, status }                        |
| `branch:<branchId>`         | `delivery.assigned`    | { orderId, agentId, agentName }            |
| `agent:<agentId>`           | `task.offered`         | { orderId, branch, customer, expiresAt }   |
| `agent:<agentId>`           | `offer.cancelled`      | { orderId, reason }                        |
| `agent:<agentId>`           | `task.assigned`        | { orderId, branch, customer }              |
| `agent:<agentId>`           | `task.cancelled`       | { orderId, reason }                        |
| `restaurant:<restaurantId>` | `order.placed`         | { orderId, branchId }                      |
| `restaurant:<restaurantId>` | `order.cancelled`      | { orderId, reason }                        |

---

## Configuration (env)

```env
ASSIGNMENT_RADIUS_METERS=5000
AGENT_ACCEPT_TIMEOUT_SEC=30
MAX_REASSIGNMENT_ATTEMPTS=3
PRESENCE_STALE_SEC=90
ASSIGNMENT_TICK_SEC=10
AGENT_EARNING_SHARE_BPS=8000    # 80% of delivery_fee to agent
SERVICE_FEE_BPS=500             # 5% platform service fee on subtotal
```

---

## Error Codes

| Code                               | HTTP | Message                                                      |
| ---------------------------------- | ---- | ------------------------------------------------------------ |
| AGENT_NOT_FOUND                    | 404  | Agent not found                                              |
| AGENT_NOT_ONLINE                   | 409  | Agent is not online                                          |
| AGENT_ALREADY_BUSY                 | 409  | Agent already has an active delivery                         |
| AGENT_CANNOT_GO_OFFLINE            | 409  | Cannot go offline with picked order                          |
| ORDER_NOT_READY_FOR_ASSIGNMENT     | 409  | Order not in ready status                                    |
| ORDER_ALREADY_CLAIMED              | 409  | Order already claimed by another agent                       |
| ORDER_CLAIM_EXPIRED                | 409  | Offer expired                                                |
| ORDER_NOT_ASSIGNED_TO_AGENT        | 403  | Order not assigned to this agent                             |
| INVALID_AGENT_TRANSITION           | 409  | Cannot transition from {from} to {to}                        |
| MAX_REASSIGNMENT_ATTEMPTS_EXCEEDED | 409  | Max reassignment attempts reached, admin intervention needed |
| BRANCH_NOT_FOUND                   | 404  | Branch not found                                             |
| INSUFFICIENT_BALANCE               | 409  | Restaurant balance insufficient for payout                   |

---

## Repository Interface

```typescript
interface OrderRepository {
  // ... existing ...
  findReadyUnassigned(limit: number, conn?: Knex): Promise<OrderEntity[]>;
  claimOrder(publicId: string, agentId: number, trx?: Knex): Promise<boolean>;
  findByAgent(agentId: number, statuses: string[], conn?: Knex): Promise<OrderEntity[]>;
}

interface AgentEarningRepository {
  COLUMNS: string[];
  insert(data: Partial<AgentEarningEntity>, trx?: Knex): Promise<AgentEarningEntity>;
  findByAgent(agentId: number, from: Date, to: Date, pagination: Pagination, conn?: Knex): Promise<AgentEarningEntity[]>;
  sumByAgent(agentId: number, from: Date, to: Date, conn?: Knex): Promise<number>;
}

interface RestaurantBalanceRepository {
  getForUpdate(restaurantId: number, currency: string, trx: Knex): Promise<RestaurantBalanceEntity>;
  upsertIncrement({ restaurantId, currency, delta }, trx?: Knex): Promise<void>;
  decrement({ restaurantId, currency, amount }, trx?: Knex): Promise<void>;
}
```

---

## Entity Classes

```typescript
// agent-earning.entity.ts
export class AgentEarningEntity {
  id: number;
  agentId: number;
  orderId: number;
  amount: number;
  currency: string;
  earnedAt: Date;
  constructor(data: Partial<AgentEarningEntity>) {
    /* assign */
  }
}

// restaurant-balance.entity.ts
export class RestaurantBalanceEntity {
  restaurantId: number;
  currency: string;
  balance: number;
  updatedAt: Date;
  constructor(data: Partial<RestaurantBalanceEntity>) {
    /* assign */
  }
}
```

---

## Response DTOs

```typescript
// delivery-task.response.dto.ts
export class DeliveryTaskResponseDTO {
  orderId: string; // public_id
  status: OrderStatus;
  branch: { id: number; name: string; lat: number; lng: number };
  customer: { name: string; phone: string; lat: number; lng: number; address: string };
  items: { name: string; quantity: number }[];
  assignedAt: string;
  pickedAt: string | null;
}

// agent-earnings.response.dto.ts
export class AgentEarningsResponseDTO {
  id: number;
  orderId: string;
  amount: number;
  currency: string;
  earnedAt: string;
}

// restaurant-balance.response.dto.ts
export class RestaurantBalanceResponseDTO {
  restaurantId: number;
  currency: string;
  balance: number;
  updatedAt: string;
}
```

---

## Service Methods

```typescript
class AgentService {
  // Presence
  async goOnline(agentId: number, lat: number, lng: number): Promise<void>;
  async ping(agentId: number, lat: number, lng: number): Promise<void>;
  async goOffline(agentId: number): Promise<void>;

  // Task management
  async acceptOrder(publicId: string, agentId: number): Promise<OrderEntity>;
  async rejectOrder(publicId: string, agentId: number): Promise<void>;
  async transitionStatus(publicId: string, agentId: number, status: 'picked' | 'delivered'): Promise<OrderEntity>;
  async getTasks(agentId: number, statuses: string[], pagination: Pagination): Promise<DeliveryTaskResponseDTO[]>;
  async getEarnings(agentId: number, from: Date, to: Date, pagination: Pagination): Promise<AgentEarningsResponseDTO[]>;
  async getEarningsSum(agentId: number, from: Date, to: Date): Promise<number>;
}

class AssignmentService {
  async tryAssign(order: OrderEntity): Promise<void>;
  async claimOrder(orderId: number, agentId: number, trx: Knex): Promise<boolean>;
  async releaseOnOffline(order: OrderEntity, agentId: number, trx: Knex): Promise<void>;
}

class SettlementService {
  async settleOrder(order: OrderEntity, trx: Knex): Promise<void>;
}

class AssignmentWorker {
  async tick(): Promise<void>; // called by croner every ASSIGNMENT_TICK_SEC
}
```
