# Database Design — Core Service (Modular Monolith)

## Conventions

- Every table has `id BIGSERIAL PRIMARY KEY` unless noted.
- **Money columns are `INT` minor units** (e.g. piasters). The platform operates in a single country, so no country or currency columns are used.
- **Fee structure**: `total = subtotal + delivery_fee`. No `service_fee`.
- Enum-like columns: `TEXT NOT NULL CHECK(col IN ('a','b'))` (no native PG ENUM).
- Timestamps: `created_at`, `updated_at`, `<verb>_at` (e.g. `accepted_at`, `delivered_at`). `TIMESTAMP NOT NULL DEFAULT NOW()` for hot rows; status-transition timestamps `TIMESTAMP NULL`.
- Index naming: `idx_<table>_<col>[_<col>]`. Constraint naming: `fk_<table>_<col>`, `uq_<table>_<col>`.
- Every FK has a supporting btree index (Postgres does not auto-index FK columns).
- No speculative indexes — each index justified by a query path in code.

## Cross-Domain References (Same DB, Real FKs)

Since we're a modular monolith with a **single database**, cross-domain references use **real FKs**:

| Reference                   | Tables                                                                                                                   | Notes   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- |
| `users.id`                  | `orders.customer_id`, `orders.agent_id`, `transactions.src_acc_id`, `transactions.dst_acc_id`, `agent_earnings.agent_id` | Real FK |
| `restaurants.id`            | `orders.restaurant_id`, `restaurant_balances.restaurant_id`                                                              | Real FK |
| `restaurant_branches.id`    | `orders.branch_id`                                                                                                       | Real FK |
| `customer_addresses.id`     | `orders.customer_address_id`                                                                                             | Real FK |
| `products.id`               | `order_items.product_id`                                                                                                 | Real FK |
| `product_branch_details.id` | `order_items.product_branch_detail_id`                                                                                   | Real FK |

We snapshot critical fields at order time (`order_items.name_snapshot`, `unit_price_snapshot`, `image_url_snapshot`) so historical orders remain readable.

---

## Tables

### 1. `orders` (Primary write target)

```sql
CREATE TABLE orders (
    id                    BIGSERIAL PRIMARY KEY,
    public_id             UUID NOT NULL UNIQUE,              -- client-facing id
    restaurant_id         BIGINT NOT NULL REFERENCES restaurants(id),
    branch_id             BIGINT NOT NULL REFERENCES restaurant_branches(id),
    customer_id           BIGINT NOT NULL REFERENCES users(id),
    customer_address_id   BIGINT NOT NULL REFERENCES customer_addresses(id),
    -- delivery snapshot (survives address edits/deletes)
    delivery_lat          DECIMAL(10,7) NOT NULL,
    delivery_lng          DECIMAL(10,7) NOT NULL,
    delivery_address_text_snapshot TEXT NOT NULL,
    -- status machine
    status                TEXT NOT NULL CHECK (status IN (
                        'pending_payment','placed','accepted','rejected',
                        'preparing','ready','assigned','picked','delivered','cancelled'
                    )),
    -- money (minor units)
    subtotal              INT NOT NULL,
    delivery_fee          INT NOT NULL,
    total                 INT NOT NULL,                        -- subtotal + delivery_fee
    commission            INT NOT NULL DEFAULT 0,              -- platform cut, computed at delivery
    payment_method        TEXT NOT NULL CHECK (payment_method IN ('online','cod')),
    -- delivery
    agent_id              BIGINT REFERENCES users(id),         -- nullable until assigned
    -- timestamps
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at           TIMESTAMP NULL,
    rejected_at           TIMESTAMP NULL,
    ready_at              TIMESTAMP NULL,
    assigned_at           TIMESTAMP NULL,
    picked_at             TIMESTAMP NULL,
    delivered_at          TIMESTAMP NULL,
    cancelled_at          TIMESTAMP NULL
);

-- supports GET /orders/{publicId}                               (customer & restaurant lookup)
CREATE INDEX idx_orders_public_id ON orders (public_id);
-- supports GET /customer/orders                                  (customer history)
CREATE INDEX idx_orders_customer_id_created_at ON orders (customer_id, created_at DESC);
-- supports GET /restaurant/orders?branchId=&status=&from=&to=    (restaurant ops dashboard)
CREATE INDEX idx_orders_branch_status_created_at ON orders (branch_id, status, created_at DESC);
-- supports DELIVERY assignment scan for pending assignment
CREATE INDEX idx_orders_status_created_at ON orders (status, created_at) WHERE status IN ('ready','assigned');
-- supports GET /agents/tasks?status=
CREATE INDEX idx_orders_agent_id_status ON orders (agent_id, status) WHERE agent_id IS NOT NULL;
```

**Notes:**

- `public_id` (UUID) is what we expose. The bigint `id` stays internal.
- `total` is denormalized for read efficiency; recomputed and asserted at insert.
- We store `delivery_address_text_snapshot` and lat/lng on the order so it remains coherent if the user later deletes the saved address.

---

### 2. `order_items`

```sql
CREATE TABLE order_items (
    id                      BIGSERIAL PRIMARY KEY,
    order_id                BIGINT NOT NULL,
    product_id              BIGINT NOT NULL REFERENCES products(id),
    product_branch_detail_id BIGINT NOT NULL REFERENCES product_branch_details(id),
    quantity                INT NOT NULL CHECK (quantity > 0),
    unit_price_snapshot     INT NOT NULL,                     -- minor units (EGP), frozen at order time
    name_snapshot           TEXT NOT NULL,
    image_url_snapshot      TEXT NULL,
    line_total              INT NOT NULL,                     -- quantity * unit_price_snapshot
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- supports GET /orders/{orderId} expansion (single batch fetch via whereIn for lists)
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
```

**Column Explanations:**

- `order_id` — FK to `orders`, CASCADE DELETE so items are removed when order is deleted
- `product_id` — FK to `products` (catalog), for reporting/analytics linking
- `product_branch_detail_id` — FK to `product_branch_details` (branch-specific pricing/stock). **This is the source of truth for the price at order time.** We snapshot `unit_price_snapshot` from this row so historical orders preserve the exact price even if branch pricing changes later.
- `unit_price_snapshot` — frozen price (minor units) copied from `product_branch_details.price` at order creation
- `name_snapshot` / `image_url_snapshot` — copied from product for historical accuracy

---

### 3. `payment_providers` (lookup)

```sql
CREATE TABLE payment_providers (
    id          INT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,                         -- 'kashier','cod'
    is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    priority    SMALLINT NOT NULL DEFAULT 100
);

-- seeded:
-- (1, 'kashier', true, 10)
-- (2, 'cod',     true, 20)
```

---

### 4. `payment_sessions` (Kashier session lifecycle)

```sql
CREATE TABLE payment_sessions (
    id                      BIGSERIAL PRIMARY KEY,
    order_id                BIGINT NOT NULL REFERENCES orders(id),
    provider_id             INT NOT NULL REFERENCES payment_providers(id),
    provider_session_id     TEXT NOT NULL UNIQUE,             -- Kashier's session id
    redirect_url            TEXT NOT NULL,
    amount                  INT NOT NULL,                     -- minor units (EGP)
    status                  TEXT NOT NULL CHECK (status IN (
                        'initialized','pending','authorized','captured','failed','expired','cancelled'
                    )),
    raw_init_payload        JSONB NOT NULL,                   -- what we sent to Kashier
    raw_last_payload        JSONB NULL,                       -- last update from Kashier
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- supports webhook lookup by Kashier session id
CREATE INDEX idx_payment_sessions_provider_session_id ON payment_sessions (provider_session_id);
-- supports order -> session lookup
CREATE INDEX idx_payment_sessions_order_id ON payment_sessions (order_id);
```

---

### 5. `transactions` (Money ledger)

Every money movement is one row. Includes payments, refunds, commissions, and **payouts**.

```sql
CREATE TABLE transactions (
    id                          BIGSERIAL PRIMARY KEY,
    order_id                    BIGINT NULL REFERENCES orders(id),        -- nullable for payouts
    transaction_type            TEXT NOT NULL CHECK (transaction_type IN (
                                'charge','refund','commission','payout','cod_collection','adjustment'
                            )),
    method                      TEXT NOT NULL CHECK (method IN ('online','cod','bank_transfer','system')),
    provider_id                 INT NULL REFERENCES payment_providers(id),
    provider_reference_id       TEXT NULL,                                 -- Kashier txn id / bank ref
    status                      TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','reversed')),
    amount                      INT NOT NULL,                              -- minor units
    -- accounting (user ids)
    src_acc_id                  BIGINT NULL REFERENCES users(id),          -- NULL => SYSTEM (platform)
    dst_acc_id                  BIGINT NULL REFERENCES users(id),          -- NULL => SYSTEM
    -- refund linkage
    is_refunded                 BOOLEAN NOT NULL DEFAULT FALSE,
    refunded_payment_id         BIGINT NULL REFERENCES transactions(id),
    -- idempotency from upstream (e.g. webhook event id)
    idempotency_key             TEXT NULL,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_transactions_idempotency_key UNIQUE (idempotency_key)
);

-- supports order detail expansion (1 round trip per order's tx ledger)
CREATE INDEX idx_transactions_order_id ON transactions (order_id);
-- supports webhook idempotency lookup by provider reference
CREATE INDEX idx_transactions_provider_reference_id ON transactions (provider_reference_id) WHERE provider_reference_id IS NOT NULL;
-- supports restaurant payout history: GET /restaurant/payouts?from=&to=
CREATE INDEX idx_transactions_dst_acc_type_created_at ON transactions (dst_acc_id, transaction_type, created_at DESC) WHERE transaction_type = 'payout';
-- supports finance reconciliation by status + type
CREATE INDEX idx_transactions_type_status_created_at ON transactions (transaction_type, status, created_at DESC);
```

**Why no separate `payouts` table:**

- Same columns needed (amount, src/dst, provider ref, status, timestamps)
- One ledger to query; no JOIN; payout history is a filter on `transaction_type='payout'`
- Unique on `idempotency_key` lets us safely re-record a payout from admin retry

---

### 6. `restaurant_balances`

One row per restaurant.

```sql
CREATE TABLE restaurant_balances (
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    balance         INT NOT NULL DEFAULT 0,                      -- minor units
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (restaurant_id)
);
```

Updates use `SELECT ... FOR UPDATE` inside the same transaction as the delivery state transition or payout insert.

---

### 7. `agent_earnings`

Per-delivered-order snapshot for reporting.

```sql
CREATE TABLE agent_earnings (
    id          BIGSERIAL PRIMARY KEY,
    agent_id    BIGINT NOT NULL REFERENCES users(id),            -- delivery_agent role
    order_id    BIGINT NOT NULL,                                 -- one earning per delivered order
    amount      INT NOT NULL,                                    -- minor units; floor(order.delivery_fee × AGENT_EARNING_SHARE_BPS / 10000)
    earned_at   TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_agent_earnings_order_id UNIQUE (order_id)      -- idempotent settlement
);
```

-- supports GET /agents/earnings?from=&to=
CREATE INDEX idx_agent_earnings_agent_earned_at ON agent_earnings (agent_id, earned_at DESC);

````

Inserted in the same transaction as `orders.status='delivered'`. The unique on `order_id` makes the settlement idempotent.

---

### 8. `payment_webhook_events`

Raw webhook log for audit and replay.

```sql
CREATE TABLE payment_webhook_events (
    id                      BIGSERIAL PRIMARY KEY,
    provider_id             INT NOT NULL REFERENCES payment_providers(id),
    provider_event_id       TEXT NOT NULL,                       -- de-dup key from provider
    signature               TEXT NOT NULL,
    payload                 JSONB NOT NULL,
    received_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at            TIMESTAMP NULL,
    process_error           TEXT NULL,

    CONSTRAINT uq_payment_webhook_events_provider_event_id UNIQUE (provider_id, provider_event_id)
);
````

**Webhook handler flow:**

1. Verify HMAC signature.
2. Try `INSERT ... ON CONFLICT DO NOTHING` on `uq_payment_webhook_events_provider_event_id`. If conflict → already processed → return 200.
3. Otherwise, in a transaction: parse payload, advance order/session/transaction state, set `processed_at`.

---

### 9. Agent Presence (Redis-only)

**No `agent_presence` table.** Presence has a 5-minute relevance window and no audit value.

**Redis keys:**

| Key                         | Type    | TTL  | Purpose                                              |
| --------------------------- | ------- | ---- | ---------------------------------------------------- |
| `presence:meta:<agentId>`   | hash    | 300s | `lat`, `lng`, `lastSeenAt`. Existence = "online"     |
| `presence:geo`              | geo set | none | Geospatial index of online agents (`GEOADD` on ping) |
| `presence:busy`             | set     | none | Set of agent ids with active assignment              |
| `offer:order:<orderId>`     | string  | 30s  | Pending offer marker (candidate agent ids)           |
| `claim:order:<orderId>`     | string  | 5min | First-to-`SETNX` wins the order                      |
| `assign:attempts:<orderId>` | string  | 1h   | Increments per assignment attempt                    |

---

## FK / Relationship Map

```
orders ──(id)── order_items
orders ──(id)── transactions
orders ──(id)── payment_sessions
orders ──(id)── agent_earnings              (logical, no FK — unique on order_id)
transactions ──(id)── transactions          (refunded_payment_id self-ref)
```

---

## Index Summary (Every Index Justified)

| Table                 | Index                                                | Supports                                         |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `orders`              | `idx_orders_public_id`                               | `GET /orders/{publicId}`                         |
| `orders`              | `idx_orders_customer_id_created_at`                  | `GET /customer/orders`                           |
| `orders`              | `idx_orders_branch_status_created_at`                | `GET /restaurant/orders?branchId&status&from&to` |
| `orders`              | `idx_orders_status_created_at` (partial)             | Auto-assignment scan for ready orders            |
| `orders`              | `idx_orders_agent_id_status` (partial)               | `GET /agents/tasks?status=`                      |
| `order_items`         | `idx_order_items_order_id`                           | Item batch fetch                                 |
| `payment_sessions`    | `idx_payment_sessions_provider_session_id`           | Webhook lookup                                   |
| `payment_sessions`    | `idx_payment_sessions_order_id`                      | Order detail                                     |
| `transactions`        | `idx_transactions_order_id`                          | Order ledger expansion                           |
| `transactions`        | `idx_transactions_provider_reference_id` (partial)   | Webhook de-dup at txn level                      |
| `transactions`        | `idx_transactions_dst_acc_type_created_at` (partial) | `GET /restaurant/payouts?from&to`                |
| `transactions`        | `idx_transactions_type_status_created_at`            | Admin reconciliation                             |
| `agent_earnings`      | `idx_agent_earnings_agent_earned_at`                 | `GET /agents/earnings?from&to`                   |
| `agent_earnings`      | `uq_agent_earnings_order_id`                         | Idempotent `delivered` settlement                |
| `restaurant_balances` | PK `(restaurant_id)`                                 | `GET /restaurants/:rid/balance` + `FOR UPDATE`   |

---

## Migration Plan (File Order)

1. `create_orders.ts` — `orders` + indexes
2. `create_order_items.ts` — `order_items` + FK + index
3. `create_payment_providers.ts` — seed `kashier`, `cod`
4. `create_payment_sessions.ts` — `payment_sessions` + indexes
5. `create_transactions.ts` — `transactions` + indexes
6. `create_payment_webhook_events.ts` — `payment_webhook_events`
7. `create_restaurant_balances.ts` — `restaurant_balances`
8. `create_agent_earnings.ts` — `agent_earnings` + indexes

**Note:** Idempotency is handled via Redis only (no `idempotency_keys` table). The Redis idempotency middleware (`lib/idempotency/idempotency.ts`) handles the fast path for `POST /orders`, `POST /payments/init`, `POST /payments/:id/refund`, `POST /admin/restaurants/:id/payouts`. For critical paths, the `transactions.idempotency_key` unique constraint provides DB-level deduplication.
