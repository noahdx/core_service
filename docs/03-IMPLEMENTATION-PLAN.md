# Implementation Plan — Core Service (Modular Monolith)

## Build Philosophy

- **One domain at a time**: Each phase builds a complete domain end-to-end (migration → entity → DTOs → repo → service → controller → routes → mount)
- **No phase mixes domains**: Complete Order domain before starting Payment, etc.
- **Each phase is shippable**: Endpoints respond with documented contracts, RBAC works, tests pass
- **Shared kernels first**: Restaurant, Branch, User, Product domains already exist — we consume them via repositories

---

## Phase 0 — Foundation & Shared Infrastructure (Already Done)

✅ Existing in codebase:

- DI container (`tsyringe`), tokens, container registration
- Express app, routes, middleware (`authenticate`, `rbac`, `validateBody`)
- Knex setup, migrations runner
- Error handling (`AppError`, global handler)
- Response helpers (`sendSuccess`, `sendPaginated`)
- Pagination (cursor-based)
- Cache (Redis), Idempotency middleware
- Logger, Correlation ID
- Health check
- Auth (JWT, RBAC permissions)

---

## Phase 1 — Orders Domain (The Spine)

### 1.1 Migration Fixes (Prerequisite)

**Current issues to fix:**

- Migration has `restaurant_owner_id` column — remove (derive from restaurant when needed)
- Migration missing `branch_lat`/`branch_lng` columns — not needed (fetch from branch when needed)
- Entity expects `branch_lat`/`branch_lng` — remove from entity
- Add `public_id` UUID column (already there)
- Ensure `product_branch_detail_id` FK in `order_items` (missing in current migration)

**Action**: Create new migration `20261016000000_fix_orders_schema.ts`

### 1.2 Files to Create/Update

| File                                                | Purpose                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/app/order/enums.ts`                            | String enums matching DB CHECK constraints                                                      |
| `src/app/order/errors.ts`                           | `AppError` instances for order domain                                                           |
| `src/app/order/types.ts`                            | Module-level types (request inputs, repo inputs, helper interfaces)                             |
| `src/app/order/dto/order-request.dto.ts`            | Request DTOs (`CreateOrderDTO`, `UpdateOrderStatusDTO`, query DTOs)                             |
| `src/app/order/dto/order-response.dto.ts`           | Response DTOs (`OrderResponseDTO`, `OrderItemResponseDTO`, `OrderSummaryDTO`, `OrderDetailDTO`) |
| `src/app/order/entity/order.entity.ts`              | Fix entity (remove `branchLat/Lng`, `restaurantOwnerId`)                                        |
| `src/app/order/entity/order-item.entity.ts`         | New: `OrderItemEntity`                                                                          |
| `src/app/order/repository/order.repository.ts`      | Repository functions (accept `conn: Knex = db`)                                                 |
| `src/app/order/repository/order-item.repository.ts` | New: Item repository                                                                            |
| `src/app/order/service/order-status.service.ts`     | Pure helper: transition validation table                                                        |
| `src/app/order/service/order.service.ts`            | Business logic (place, get, list, updateStatus, cancel)                                         |
| `src/app/order/controller/order.controller.ts`      | Controllers (validate → service → DTO → respond)                                                |
| `src/app/order/routes.ts`                           | Wire middleware + controller methods                                                            |
| `src/routes.ts`                                     | Mount `/api/restaurants/:restaurantId/branches/:branchId/orders`                                |

### 1.3 Core-Service Dependencies (Already Exist)

- `RestaurantRepository`, `BranchRepository`, `ProductRepository`, `ProductBranchDetailsRepository`
- `CustomerAddressRepository`
- `UserService` (for customer validation)

### 1.4 Acceptance Criteria

- `POST /restaurants/:restaurantId/branches/:branchId/orders` — creates COD order, returns 201 with `OrderResponseDTO`
- Idempotency: same key → same response; different body → 409
- `PATCH /restaurants/:restaurantId/branches/:branchId/orders/:orderId/status` — valid transitions work; invalid → 409
- `GET /restaurants/:restaurantId/branches/:branchId/orders?status=placed` — returns paginated `OrderSummaryDTO[]`, uses index
- `GET /customer/orders` — returns customer history
- Stock reservation via core-service (sync call) works; rollback on failure

---

## Phase 2 — Payments Domain (Kashier Integration)

### 2.1 Migrations

1. `create_payment_providers.ts` — lookup table, seed `kashier` (id=1), `cod` (id=2)
2. `create_payment_sessions.ts` — `payment_sessions` table
3. `create_transactions.ts` — `transactions` ledger table
4. `create_payment_webhook_events.ts` — webhook audit log

### 2.2 Files to Create

| File                                                             | Purpose                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/pkg/payments/payment.interface.ts`                          | `IPaymentProvider` interface                                            |
| `src/pkg/payments/kashier/kashier.client.ts`                     | HTTP client for Kashier v3                                              |
| `src/pkg/payments/kashier/kashier.signature.ts`                  | HMAC-SHA256 verification                                                |
| `src/pkg/payments/kashier/kashier.types.ts`                      | Provider DTOs                                                           |
| `src/app/payment/enums.ts`                                       | `PaymentSessionStatus`, `TransactionType`, `TransactionStatus`          |
| `src/app/payment/errors.ts`                                      | Domain errors                                                           |
| `src/app/payment/types.ts`                                       | Module types                                                            |
| `src/app/payment/dto/payment-request.dto.ts`                     | `InitPaymentDTO`, `RefundRequestDTO`                                    |
| `src/app/payment/dto/payment-response.dto.ts`                    | `PaymentInitResponseDTO`, `PaymentResponseDTO`, `TransactionSummaryDTO` |
| `src/app/payment/entity/payment-session.entity.ts`               | `PaymentSessionEntity`                                                  |
| `src/app/payment/entity/transaction.entity.ts`                   | `TransactionEntity`                                                     |
| `src/app/payment/repository/payment-session.repository.ts`       | Repo functions                                                          |
| `src/app/payment/repository/transaction.repository.ts`           | Repo functions                                                          |
| `src/app/payment/repository/payment-webhook-event.repository.ts` | Repo functions                                                          |
| `src/app/payment/service/kashier-webhook.service.ts`             | Verify signature, process webhook events                                |
| `src/app/payment/service/payment.service.ts`                     | `init`, `getByOrder`, `refund`, `reconcile`                             |
| `src/app/payment/controller/payment.controller.ts`               | Auth'd endpoints                                                        |
| `src/app/payment/controller/webhook.controller.ts`               | Public webhook endpoint (HMAC only)                                     |
| `src/app/payment/routes.ts`                                      | Wire routes                                                             |

### 2.3 Integration Points

- `OrderService.placeOrder` → calls `PaymentService.init()` for online orders
- Webhook → updates order status to `placed` via `OrderService.updateStatus()`
- Refund → `PaymentService.requestRefund()` → calls Kashier refund API

### 2.4 Acceptance Criteria

- `POST /orders/:orderId/payment/init` — creates Kashier session, returns `redirectUrl`
- Webhook `POST /payments/webhook/kashier` — HMAC verified, duplicate → 200, order → `placed`
- `POST /payments/:paymentId/refund` — creates refund transaction, webhook completes it
- Duplicate webhook (same `provider_event_id`) → 200, no side effects

---

## Phase 3 — Agents & Deliveries Domain

### 3.1 Migrations

1. `create_restaurant_balances.ts` — `restaurant_balances` table (PK: restaurant_id)
2. `create_agent_earnings.ts` — `agent_earnings` table (unique on order_id)

**No `agent_presence` table** — Redis only (see `docs/02-DATABASE-DESIGN.md` §9)

### 3.2 Files to Create

| File                                                        | Purpose                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/app/agent/enums.ts`                                    | (minimal, mostly reuses OrderStatus)                              |
| `src/app/agent/errors.ts`                                   | Domain errors                                                     |
| `src/app/agent/types.ts`                                    | Module types                                                      |
| `src/app/agent/dto/agent-request.dto.ts`                    | `PresenceOnlineDTO`, `PresencePingDTO`, `AssignAgentDTO`          |
| `src/app/agent/dto/agent-response.dto.ts`                   | `DeliveryTaskDTO`, `AgentEarningsDTO`, `RestaurantBalanceDTO`     |
| `src/app/agent/entity/restaurant-balance.entity.ts`         | `RestaurantBalanceEntity`                                         |
| `src/app/agent/entity/agent-earning.entity.ts`              | `AgentEarningEntity`                                              |
| `src/app/agent/repository/restaurant-balance.repository.ts` | `getForUpdate`, `upsertIncrement`, `decrement`                    |
| `src/app/agent/repository/agent-earning.repository.ts`      | `insertEarning`, `listByAgent`, `sumByAgent`                      |
| `src/app/agent/service/presence.service.ts`                 | Redis-only: `goOnline`, `ping`, `goOffline`                       |
| `src/app/agent/service/assignment.service.ts`               | `tryAssign`, `claim`, `releaseOnOffline` (geo search via Redis)   |
| `src/app/agent/service/settlement.service.ts`               | `settleOrder` (runs on DELIVERED)                                 |
| `src/app/agent/service/agent.service.ts`                    | `accept`, `reject`, `transitionStatus`, `getTasks`, `getEarnings` |
| `src/app/agent/controller/agent.controller.ts`              | Agent endpoints (presence, tasks, earnings)                       |
| `src/app/agent/controller/admin-assignment.controller.ts`   | Admin override assignment                                         |
| `src/app/agent/routes.ts`                                   | Wire routes                                                       |
| `src/app/agent/worker/assignment.worker.ts`                 | Cron job: every 10s scan ready orders → `tryAssign`               |

### 3.3 Redis Keys (No SQL Tables)

```
presence:meta:<agentId>     → hash {lat, lng, lastSeenAt}  TTL 300s
presence:geo                → geo set (GEOADD)
presence:busy               → set of agentIds
offer:order:<orderId>       → string (candidate agentIds)  TTL 30s
claim:order:<orderId>       → string (agentId)  TTL 5min
assign:attempts:<orderId>   → string (counter)  TTL 1h
```

### 3.4 Acceptance Criteria

- Agent `POST /agents/presence/online` → Redis keys set, TTL 300s
- Order `ready` → next worker tick (≤10s) broadcasts `task.offered` to 5 closest online+non-busy agents
- Two agents accept simultaneously → exactly one wins via `SETNX claim:order:<id>`
- Winner: `orders.agent_id` set, `status=assigned`, `presence:busy` includes agent
- Agent `assigned → picked → delivered` transitions work
- On `delivered`: `restaurant_balances += subtotal - commission`, `agent_earnings` inserted, `presence:busy` cleaned
- Admin `POST /admin/orders/:publicId/assign {agentId}` bypasses distance/busy
- After `MAX_REASSIGNMENT_ATTEMPTS` (3) failed broadcasts → admin alert, order stays `ready`

---

## Phase 4 — Restaurant Finance Domain

### 4.1 Migrations

**None** — uses existing `restaurant_balances`, `transactions`, `agent_earnings`

### 4.2 Files to Create

| File                                               | Purpose                                                         |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `src/app/finance/errors.ts`                        | `InsufficientBalanceError`, etc.                                |
| `src/app/finance/types.ts`                         | Module types                                                    |
| `src/app/finance/dto/finance-request.dto.ts`       | `CreatePayoutDTO`                                               |
| `src/app/finance/dto/finance-response.dto.ts`      | `RestaurantBalanceDTO`, `TransactionDTO`, `PayoutDTO`           |
| `src/app/finance/service/finance.service.ts`       | `getBalance`, `listTransactions`, `listPayouts`, `recordPayout` |
| `src/app/finance/controller/finance.controller.ts` | Restaurant + admin endpoints                                    |
| `src/app/finance/routes.ts`                        | Wire routes                                                     |

### 4.3 Commission Activation (Deferred from Phase 3)

In `SettlementService.settleOrder`:

- Fetch `branch.commission_bps` via cached core-client
- `commission = floor(subtotal * commission_bps / 10000)`
- Write `orders.commission`
- Insert `transactions(type='commission', idempotency_key='commission:'+publicId)`
- Restaurant balance increment uses `subtotal - commission` (was `subtotal` in Phase 3)

### 4.4 Backfill Script

`play/backfill-phase3-commissions.ts` — one-shot for orders delivered during Phase 3

### 4.5 Acceptance Criteria

- `GET /restaurants/:restaurantId/balance` — owner/manager only, returns current balance
- `GET /restaurants/:restaurantId/transactions` — paginated ledger
- `GET /restaurants/:restaurantId/payouts` — payout history
- `POST /admin/restaurants/:restaurantId/payouts` — admin only, idempotent, balance decrements
- Payout > balance → 409 `InsufficientBalance`
- New `delivered` orders produce `commission > 0` + commission transaction row

---

## Phase 5 — Cold Archival Worker (Future)

> **Deferred** — only current year in hot DB. When needed:

### 5.1 Archive Cluster

- Separate archive database for cold storage
- Same schema as hot DB

### 5.2 Worker

- Nightly cron
- Move rows where `created_at < date_trunc('year', NOW())`
- Batch size 1000, FK-safe order: `agent_earnings → payment_webhook_events → payment_sessions → transactions → order_items → orders`
- Archive trx commit first, then hot trx delete (safe on crash)
- `ON CONFLICT DO NOTHING` on archive insert for idempotency

### 5.3 Read Path Routing

- `GET /customer/orders?year=2025` → routes to archive cluster
- `GET /orders/{publicId}` → try hot first, fallback to archive (admin only)

---

## Build Order Summary

```
Phase 0  ✅ Foundation (done)
Phase 1  Orders (COD end-to-end)           ──►  1.1 Migration → 1.2-1.4 files
Phase 2  Payments + Kashier (online)       ──►  2.1 Migrations → 2.2 pkg/ + app/payment/
Phase 3  Agents & Deliveries (single phase) ──►  3.1 Migrations → 3.2 Redis + worker
Phase 4  Restaurant Finance                ──►  4.2 files + commission activation
Phase 5  Archival (future)
```

---

## Cross-Cutting Concerns (Apply to All Phases)

| Concern           | Implementation                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Validation**    | `validateBody(DTO)` middleware on all mutating endpoints                                                                  |
| **Idempotency**   | `idempotency({strict:true})` on `POST /orders`, `POST /payments/init`, `POST /payments/:id/refund`, `POST /admin/payouts` |
| **Caching**       | `withCache(10s)` on `GET /restaurant/orders` per branch+status; `withCache(5s)` on `GET /agents/tasks`                    |
| **RBAC**          | `rbac({resource: 'orders', action: 'read                                                                                  | create | update | cancel'})` etc. |
| **Transactions**  | Explicit `trx = await db.transaction(); try { ... await trx.commit() } catch { await trx.rollback(); throw }`             |
| **Response DTOs** | Every controller returns `ResponseDTO` via `sendSuccess`/`sendPaginated` — never raw entities                             |
| **Money**         | All amounts `INT` minor units (e.g. piasters); no currency or country columns                                             |
| **Timestamps**    | ISO 8601 UTC strings in responses                                                                                         |
| **IDs**           | Public order ID = UUID (`public_id`); internal = bigint                                                                   |

---

## Environment Variables (Add to `.env`)

```env
# Payments (Kashier)
KASHIER_BASE_URL=https://test-api.kashier.io
KASHIER_MERCHANT_ID=MID-XXXX-XXXX
KASHIER_API_KEY=pk_test_xxx
KASHIER_SECRET_KEY=sk_test_xxx
KASHIER_WEBHOOK_SECRET=whsec_xxx
KASHIER_RETURN_URL=https://app.example.com/checkout/return
KASHIER_FAIL_URL=https://app.example.com/checkout/failed
PAYMENT_SESSION_TIMEOUT_MIN=15

# Deliveries / Assignment
ASSIGNMENT_RADIUS_METERS=5000
AGENT_ACCEPT_TIMEOUT_SEC=30
MAX_REASSIGNMENT_ATTEMPTS=3
PRESENCE_STALE_SEC=90
ASSIGNMENT_TICK_SEC=10

# Finance
AGENT_EARNING_SHARE_BPS=8000    # 80% of delivery_fee to agent
```

---

## Next Steps

1. **Create Phase 1 migration fix** (`20261016000000_fix_orders_schema.ts`)
2. **Implement Order domain files** in order: enums → errors → types → DTOs → entities → repos → services → controller → routes
3. **Test COD order flow end-to-end**
4. **Proceed to Phase 2 (Payments)**
