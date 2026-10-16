# Business Logic — Restaurant Finance

## Overview

Finance domain handles restaurant balances, commissions, and payouts. All money movements are recorded in the `transactions` ledger.

---

## Restaurant Balance

### Balance Updates

Restaurant balance increases on:

- **Order delivered** (online): `+ (subtotal - commission)`
- **Order delivered** (COD): `+ (subtotal - commission)` — COD collection recorded separately

Restaurant balance decreases on:

- **Payout** (admin-recorded): `- payout_amount`

### Balance Model

```typescript
// restaurant_balances table: one row per restaurant
{
  restaurant_id: number,      // PK, FK to restaurants
  balance: number,            // minor units (piasters), can be negative
  updated_at: Date
}
```

### Concurrency Control

All balance updates use `SELECT ... FOR UPDATE` inside the same transaction as the triggering event:

```typescript
async function incrementBalance(restaurantId: number, delta: number, trx: Knex) {
  const row = await trx('restaurant_balances')
    .where('restaurant_id', restaurantId)
    .forUpdate() // row lock
    .first();

  const newBalance = (row?.balance || 0) + delta;
  await trx('restaurant_balances')
    .insert({ restaurant_id: restaurantId, balance: newBalance })
    .onConflict('restaurant_id')
    .merge({ balance: newBalance, updated_at: new Date() });
}
```

---

## Commission Calculation

Computed at **delivery time** (when order status → `delivered`):

```
commission = floor(order.subtotal * branch.commission_bps / 10000)
```

- `branch.commission_bps` comes from core-service (cached, e.g., 1500 = 15%)
- Written to `orders.commission`
- Recorded as `transactions` row: `type='commission', method='system'`
- Source: `src_acc_id = restaurant_owner_id` (restaurant pays)
- Destination: `dst_acc_id = NULL` (platform receives)

### Idempotency

`transactions.idempotency_key = 'commission:' + order.public_id` (unique constraint)

---

## Settlement Flow (on DELIVERED)

Runs in single transaction:

```typescript
async function settleOrder(order: OrderEntity, trx: Knex) {
  // 1. COD: mark collection succeeded
  if (order.payment_method === 'cod') {
    await transactionRepo.updateCODCollection(order.id, 'succeeded', trx);
  }

  // 2. Online: charge transaction already created by payment webhook

  // 3. Commission
  const branch = await branchClient.getBranch(order.branch_id); // cached
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
        currency: 'EGP',
        src_acc_id: order.restaurant_owner_id,
        dst_acc_id: null,
        idempotency_key: `commission:${order.public_id}`,
      },
      trx,
    );
  }

  // 4. Restaurant balance: + (subtotal - commission)
  const netToRestaurant = order.subtotal - commission;
  await restaurantBalanceRepo.upsertIncrement(
    {
      restaurant_id: order.restaurant_id,
      delta: netToRestaurant,
    },
    trx,
  );

  // 5. Agent earnings
  const agentEarning = Math.floor((order.delivery_fee * AGENT_EARNING_SHARE_BPS) / 10000);
  await agentEarningRepo.insert(
    {
      agent_id: order.agent_id,
      order_id: order.id,
      amount: agentEarning,
    },
    trx,
  ); // unique on order_id = idempotent
}
```

---

## Payouts

### Payout Recording (Admin Only)

```
POST /api/admin/restaurants/:restaurantId/payouts
{ amount: number, reference: string, idempotencyKey: string }
```

### Rules

- Only users with `finance:payout_create` permission (admin)
- Amount > 0, ≤ current balance (else 409 `InsufficientBalance`)
- Idempotent via `transactions.idempotency_key = 'payout:' + reference`
- Records: `transactions(type='payout', method='bank_transfer', status='succeeded')`
- Decrements `restaurant_balances.balance`

```typescript
async function recordPayout(restaurantId: number, amount: number, reference: string, adminId: number, trx: Knex) {
  // 1. Lock balance row
  const balance = await restaurantBalanceRepo.getForUpdate(restaurantId, trx);
  if (balance.balance < amount) {
    throw new AppError('InsufficientBalance', 409);
  }

  // 2. Insert payout transaction (idempotent)
  await transactionRepo.insert(
    {
      order_id: null,
      transaction_type: 'payout',
      method: 'bank_transfer',
      provider_id: null,
      provider_reference_id: reference,
      status: 'succeeded',
      amount,
      currency: 'EGP',
      src_acc_id: null, // platform pays out
      dst_acc_id: restaurantOwnerId, // restaurant receives
      idempotency_key: `payout:${reference}`,
    },
    trx,
  );

  // 3. Decrement balance
  await restaurantBalanceRepo.decrement({ restaurantId, amount }, trx);
}
```

---

## Transaction Ledger

### Transaction Types

| Type             | Description               | Src        | Dst        | Method          |
| ---------------- | ------------------------- | ---------- | ---------- | --------------- |
| `charge`         | Online payment success    | Customer   | Platform   | `online`        |
| `cod_collection` | COD collected at delivery | Customer   | Platform   | `cod`           |
| `commission`     | Platform commission       | Restaurant | Platform   | `system`        |
| `refund`         | Customer refund           | Platform   | Customer   | `online`/`cod`  |
| `payout`         | Restaurant payout         | Platform   | Restaurant | `bank_transfer` |
| `adjustment`     | Manual correction         | varies     | varies     | `system`        |

### Query Patterns

| Endpoint                                | Query                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| `GET /restaurants/:id/transactions`     | `WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id=?)`  |
| `GET /restaurants/:id/payouts`          | `WHERE transaction_type='payout' AND dst_acc_id=restaurantOwnerId` |
| `GET /admin/transactions?type=&status=` | `WHERE transaction_type=? AND status=?`                            |

---

## API Endpoints

| Method | Path                                         | Auth                             | Description                     |
| ------ | -------------------------------------------- | -------------------------------- | ------------------------------- |
| GET    | /api/restaurants/:restaurantId/balance       | ✓ (owner/manager)                | Current balance                 |
| GET    | /api/restaurants/:restaurantId/transactions  | ✓ (owner/manager)                | Transaction history (paginated) |
| GET    | /api/restaurants/:restaurantId/payouts       | ✓ (owner/manager)                | Payout history                  |
| POST   | /api/admin/restaurants/:restaurantId/payouts | ✓ (admin, finance:payout_create) | Record payout                   |

---

## DTOs

### RestaurantBalanceResponseDTO

```typescript
class RestaurantBalanceResponseDTO {
  restaurantId: number;
  balance: number; // minor units (EGP)
  currency: 'EGP';
  updatedAt: string;
}
```

### TransactionResponseDTO

```typescript
class TransactionResponseDTO {
  id: number;
  orderId: number | null;
  orderPublicId: string | null;
  type: TransactionType;
  method: 'online' | 'cod' | 'bank_transfer' | 'system';
  status: 'pending' | 'succeeded' | 'failed' | 'reversed';
  amount: number; // minor units (EGP)
  currency: 'EGP';
  providerReferenceId: string | null;
  description: string; // human-readable
  createdAt: string;
}
```

### CreatePayoutRequestDTO

```typescript
class CreatePayoutRequestDTO {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference: string; // bank transfer reference
}
```

---

## Service Methods

### FinanceService

```typescript
class FinanceService {
  async getBalance(restaurantId: number): Promise<RestaurantBalanceResponseDTO>;
  async listTransactions(
    restaurantId: number,
    filters: TransactionFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<TransactionResponseDTO>>;
  async listPayouts(
    restaurantId: number,
    from: Date,
    to: Date,
    pagination: Pagination,
  ): Promise<PaginatedResult<TransactionResponseDTO>>;
  async recordPayout(restaurantId: number, adminId: number, dto: CreatePayoutRequestDTO): Promise<TransactionResponseDTO>;
}
```

### RestaurantBalanceRepository

```typescript
interface RestaurantBalanceRepository {
  getForUpdate(restaurantId: number, trx: Knex): Promise<RestaurantBalanceEntity | undefined>;
  upsertIncrement({ restaurantId, delta }, trx?: Knex): Promise<void>;
  decrement({ restaurantId, amount }, trx?: Knex): Promise<void>;
  findByRestaurant(restaurantId: number, conn?: Knex): Promise<RestaurantBalanceEntity | undefined>;
}
```

---

## Entity Classes

```typescript
// restaurant-balance.entity.ts
export class RestaurantBalanceEntity {
  restaurantId: number;
  balance: number;
  updatedAt: Date;
  constructor(data: Partial<RestaurantBalanceEntity>) {
    /* assign */
  }
}

// transaction.entity.ts
export enum TransactionType {
  CHARGE = 'charge',
  REFUND = 'refund',
  COMMISSION = 'commission',
  PAYOUT = 'payout',
  COD_COLLECTION = 'cod_collection',
  ADJUSTMENT = 'adjustment',
}

export class TransactionEntity {
  id: number;
  orderId: number | null;
  transactionType: TransactionType;
  method: 'online' | 'cod' | 'bank_transfer' | 'system';
  providerId: number | null;
  providerReferenceId: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'reversed';
  amount: number;
  currency: string;
  srcAccId: number | null;
  dstAccId: number | null;
  isRefunded: boolean;
  refundedPaymentId: number | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  constructor(data: Partial<TransactionEntity>) {
    /* assign */
  }
}
```

---

## Error Codes

| Code                          | HTTP | Message                                     |
| ----------------------------- | ---- | ------------------------------------------- |
| RESTAURANT_BALANCE_NOT_FOUND  | 404  | Restaurant balance not found                |
| INSUFFICIENT_BALANCE          | 409  | Insufficient balance for payout             |
| PAYOUT_IDEMPOTENCY_CONFLICT   | 409  | Payout with this reference already recorded |
| INVALID_PAYOUT_AMOUNT         | 400  | Payout amount must be positive              |
| COMMISSION_CALCULATION_FAILED | 500  | Failed to calculate commission              |

---

## Configuration (env)

```env
AGENT_EARNING_SHARE_BPS=8000    # 80% of delivery_fee to agent
SERVICE_FEE_BPS=500             # 5% platform service fee on subtotal
```

---

## Financial Reconciliation

### Daily Reconciliation Query

```sql
-- Restaurant net: sum of charges - commissions - payouts
SELECT
  r.id as restaurant_id,
  r.name,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'charge' THEN t.amount END), 0) as total_charges,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'commission' THEN t.amount END), 0) as total_commission,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'payout' THEN t.amount END), 0) as total_payouts,
  rb.balance as current_balance
FROM restaurants r
LEFT JOIN orders o ON o.restaurant_id = r.id
LEFT JOIN transactions t ON t.order_id = o.id AND t.status = 'succeeded'
LEFT JOIN restaurant_balances rb ON rb.restaurant_id = r.id
GROUP BY r.id, r.name, rb.balance;
```

### Invariant Checks

1. **Balance Consistency**: `restaurant_balances.balance` = sum of all succeeded transactions for restaurant
2. **Commission Integrity**: Every `delivered` order has exactly one `commission` transaction
3. **COD Integrity**: Every `delivered` COD order has `cod_collection` succeeded
4. **Payout Integrity**: Sum of payouts ≤ sum of (charges - commissions) for restaurant
