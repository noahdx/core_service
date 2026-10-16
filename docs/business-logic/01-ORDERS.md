# Business Logic — Orders

## Order Lifecycle (Status Machine)

```
PENDING_PAYMENT → PLACED → ACCEPTED → PREPARING → READY → ASSIGNED → PICKED → DELIVERED
                    ↓           ↓           ↓          ↓
                   CANCELLED  REJECTED   CANCELLED  CANCELLED
                                                        ↓
                                                      REFUNDED (partial/full, after DELIVERED)
```

### Status Meanings

| Status            | Who Sets                          | Description                                               |
| ----------------- | --------------------------------- | --------------------------------------------------------- |
| `pending_payment` | Customer                          | Order created, awaiting online payment (Kashier)          |
| `placed`          | Customer (COD) / Webhook (online) | Payment confirmed or COD order placed                     |
| `accepted`        | Restaurant                        | Restaurant accepts the order                              |
| `rejected`        | Restaurant                        | Restaurant rejects (capacity, closed, etc.)               |
| `preparing`       | Restaurant                        | Kitchen started cooking                                   |
| `ready`           | Restaurant                        | Food ready for pickup                                     |
| `assigned`        | System (auto)                     | Delivery agent assigned                                   |
| `picked`          | Agent                             | Agent picked up food from branch                          |
| `delivered`       | Agent                             | Agent delivered to customer                               |
| `cancelled`       | Customer / Restaurant             | Cancelled before `delivered`                              |
| `refunded`        | Admin / Finance                   | Post-delivery refund (creates `transactions` type=refund) |

### Transition Rules

| From → To                       | Allowed Actor                    | Conditions                              |
| ------------------------------- | -------------------------------- | --------------------------------------- |
| `pending_payment` → `placed`    | Webhook (online)                 | Kashier webhook `pay.SUCCESS`           |
| `pending_payment` → `cancelled` | Customer                         | Anytime before payment                  |
| `pending_payment` → `cancelled` | System                           | Payment session expires/failed          |
| `placed` → `accepted`           | Restaurant (owner/manager/staff) | Branch accepting orders                 |
| `placed` → `rejected`           | Restaurant                       | Any reason                              |
| `placed` → `cancelled`          | Customer                         | Within 60s of `placed` (configurable)   |
| `accepted` → `preparing`        | Restaurant                       |                                         |
| `accepted` → `cancelled`        | Restaurant                       |                                         |
| `preparing` → `ready`           | Restaurant                       |                                         |
| `preparing` → `cancelled`       | Restaurant                       |                                         |
| `ready` → `assigned`            | System (assignment worker)       | Agent accepts offer                     |
| `ready` → `cancelled`           | Restaurant                       |                                         |
| `assigned` → `picked`           | Agent                            | At branch location                      |
| `assigned` → `ready`            | System                           | Agent went offline / rejected / timeout |
| `picked` → `delivered`          | Agent                            | At customer location                    |
| `delivered` → `refunded`        | Admin (finance)                  | Partial or full refund                  |

### Cancellation Rules

- **Customer**: Can cancel from `pending_payment`, `placed` (within 60s), `accepted`, `preparing`
- **Restaurant**: Can cancel from `placed`, `accepted`, `preparing`, `ready` (before assignment)
- **System**: Auto-cancels `pending_payment` on payment expiry/failure
- **After `assigned`**: Only agent can cancel (marks `ready` for reassignment)
- **After `picked`**: Cannot cancel — must deliver or refund post-delivery

---

## Money Calculations

All amounts in **minor units** (e.g. piasters). Platform operates in a single country without country/currency columns.

```
subtotal      = Σ(item.unitPrice * item.quantity)
delivery_fee  = branch.delivery_fee (minor units)
total         = subtotal + delivery_fee
commission    = floor(subtotal * branch.commission_bps / 10000)
```

- `delivery_fee` and `commission` come from branch configuration or defaults.
- `total = subtotal + delivery_fee`.
- `commission` is stored on `orders.commission`.

---

## Order Creation Flow

```
1. Customer POST /api/restaurants/:restaurantId/branches/:branchId/orders
   - Validate: branch active & accepting orders, customer owns address, items in stock
   - Fetch branch metadata (commission)
   - Fetch product prices/stock for branch
   - Compute money (subtotal, delivery_fee, total = subtotal + delivery_fee)
   - Reserve stock atomically in transaction
   - DB transaction:
     a. INSERT orders (status = paymentMethod=='cod' ? 'placed' : 'pending_payment')
     b. INSERT order_items (with snapshots)
   - Return OrderResponseDTO
```

### Validation at Create

1. Branch exists, `is_active=true`, `accept_orders=true`, `restaurant_status != 'suspended'`
2. Customer address belongs to customer, has valid lat/lng
3. All productIds exist, active, available at branch (stock > 0)
4. Quantities 1-50 per item
5. Subtotal >= branch.min_order_amount (if set)
6. Idempotency key not used (Redis + DB fallback)

---

## Stock Reservation

- At order create, we call `core-service.POST /api/internal/branches/:branchId/reserve-stock`
- Core decrements `product_branch_details.stock` atomically in one trx
- Idempotent via `Idempotency-Key` header (same as our order create key)
- On failure (409 OutOfStock), we rollback our order trx and return 409
- On our trx rollback (e.g., DB error), we call core to release reservation (compensating)

---

## Status Transition Flow (Service)

```typescript
async updateStatus(orderId, newStatus, actorId, actorRole, reason?) {
  const order = await repo.findById(orderId);
  assertTransition(order.status, newStatus, actorRole);  // throws AppError if invalid

  const trx = await db.transaction();
  try {
    const updates = { status: newStatus, updated_at: new Date() };
    updates[`${newStatus}_at`] = new Date();  // e.g. accepted_at

    await repo.updateStatus(orderId, updates, trx);

    // Side effects per transition
    switch (newStatus) {
      case 'placed':
        if (order.payment_method === 'online') {
          // already handled by webhook
        } else {
          await transactionRepo.insertCODCollection(order, trx);
        }
        break;
      case 'ready':
        await assignmentWorker.notifyReady(order, trx);  // triggers auto-assignment
        break;
      case 'delivered':
        await settlementService.settleOrder(order, trx);
        break;
      case 'cancelled':
        await releaseStockIfNeeded(order, trx);
        break;
    }

    await trx.commit();
    await ws.publishOrderStatusChanged(order, newStatus);
    return order;
  } catch (e) {
    await trx.rollback();
    throw e;
  }
}
```

---

## Restaurant Orders List (Hot Path)

**Query**: `GET /restaurants/:restaurantId/branches/:branchId/orders?status=placed,preparing&from=&to=`

- Cached with `withCache(10s)` per `(branchId, status)`
- Uses `idx_orders_branch_status_created_at`
- Cursor pagination (no offset)
- Returns `OrderSummaryResponseDTO[]` (lightweight, no items)

---

## Customer Orders History

**Query**: `GET /customer/orders?year=YYYY`

- Uses `idx_orders_customer_id_created_at`
- Cursor pagination
- Current year only (older years → archive in future)

---

## Events Published (In-Process)

| Event                  | Payload                                                     | Consumers                                  |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `order.created`        | { orderId, publicId, branchId, customerId, total, items[] } | PaymentService.init()                      |
| `order.placed`         | { orderId, publicId, paymentMethod }                        | Agent (assignment queue), WS               |
| `order.status_changed` | { orderId, publicId, from, to, actorId }                    | WS (customer, branch, agent)               |
| `order.cancelled`      | { orderId, publicId, reason, cancelledBy }                  | Payment (void), Stock (release), WS        |
| `order.delivered`      | { orderId, publicId, agentId, deliveredAt }                 | Finance (settlement), Agent (earnings), WS |

---

## Error Codes

| Code                                 | HTTP | Message                                                |
| ------------------------------------ | ---- | ------------------------------------------------------ |
| ORDER_NOT_FOUND                      | 404  | Order not found                                        |
| ORDER_INVALID_TRANSITION             | 409  | Cannot transition from {from} to {to}                  |
| ORDER_BRANCH_NOT_ACCEPTING           | 409  | Branch is not accepting orders                         |
| ORDER_OUT_OF_STOCK                   | 409  | Product {id} out of stock (requested: X, available: Y) |
| ORDER_IDEMPOTENCY_CONFLICT           | 409  | Idempotency key already used with different payload    |
| ORDER_CUSTOMER_CANCEL_WINDOW_EXPIRED | 409  | Cancellation window expired (60s after placed)         |
| ORDER_CANNOT_CANCEL                  | 409  | Order cannot be cancelled in status {status}           |
| ORDER_MINIMUM_NOT_MET                | 400  | Order amount below minimum {amount}                    |
| ORDER_ADDRESS_MISMATCH               | 400  | Address does not belong to customer                    |
