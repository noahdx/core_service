# API Contracts — Core Service (Modular Monolith)

## Conventions

### Headers (Request)

| Header                 | Required                           | Notes                                                |
| ---------------------- | ---------------------------------- | ---------------------------------------------------- |
| `Cookie: access_token` | All authenticated endpoints        | Issued by `/api/auth/login`                          |
| `Idempotency-Key`      | All `POST`/`PATCH` write endpoints | Strict on order create, payment init, refund, payout |
| `X-CorrelationId`      | Optional                           | Auto-generated if missing; echoed in response        |

### Headers (Response)

| Header               | Always Present               |
| -------------------- | ---------------------------- |
| `X-CorrelationId`    | Request ID                   |
| `X-Cache: HIT\|MISS` | Endpoints behind `withCache` |

### Response Envelope

```json
// Success (single)
{ "success": true, "data": <DTO>, "meta": { ... }? }

// Success (paginated)
{ "success": true, "data": [<DTO>, ...], "meta": { "nextCursor": "...", "hasMore": true, "count": 20 } }

// Error
{ "success": false, "error": "<message>", "code": "<ERROR_CODE>" }
```

### HTTP Status Codes

| Code | Meaning                                                                 |
| ---- | ----------------------------------------------------------------------- |
| 200  | OK — success                                                            |
| 201  | Created — POST created resource                                         |
| 400  | Validation error                                                        |
| 401  | Not authenticated                                                       |
| 403  | Not authorized (RBAC)                                                   |
| 404  | Not found                                                               |
| 409  | Conflict (idempotency, illegal transition, insufficient balance, stock) |
| 502  | Upstream error (Kashier, core-service)                                  |
| 503  | Service unavailable                                                     |

### Money

Always **integer minor units** (e.g. piasters). Platform operates in a single country, so no country or currency fields are included.
Example: `"amount": 24000` = 240.00 in minor units.

### Timestamps

ISO 8601 UTC strings: `"2026-10-16T15:42:11.123Z"`

### IDs

- Public order ID: UUID string (`publicId`)
- Other public IDs: bigint serialized as JSON number
- Internal IDs (bigserial) never exposed

### Pagination (Cursor)

Query: `?cursor=<opaque>&limit=20&sortBy=createdAt&sortOrder=desc`
Response meta: `{ "nextCursor": "...", "hasMore": true, "count": 20 }`

### Filters

`?filter[<field>][<op>]=<value>` — ops: `eq, gt, lt, gte, lte, like, in`

---

## 1. Orders

### 1.1 POST /api/restaurants/:restaurantId/branches/:branchId/orders

**Place a new order**

**Headers:** `Cookie`, `Idempotency-Key` (strict)

**Path Params:**

- `restaurantId` (number)
- `branchId` (number)

**Request Body:**

```typescript
class CreateOrderDTO {
  @IsInt()
  @Min(1)
  customerAddressId: number;

  @IsEnum(PaymentMethod)
  paymentMethod: 'online' | 'cod';

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDTO)
  items: OrderItemInputDTO[];
}

class OrderItemInputDTO {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;
}
```

**Response 201:**

```typescript
class OrderResponseDTO {
  publicId: string; // UUID
  status: OrderStatus; // 'pending_payment' | 'placed' | ...
  paymentMethod: 'online' | 'cod';
  branch: { id: number; name: string };
  restaurant: { id: number; name: string };
  customerAddress: { lat: number; lng: number; addressText: string };
  subtotal: number; // minor units
  deliveryFee: number;
  total: number;
  items: OrderItemResponseDTO[];
  createdAt: string;
  // online only:
  payment?: { sessionId: string; redirectUrl: string };
}

class OrderItemResponseDTO {
  productId: number;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number; // minor units
  lineTotal: number;
}
```

**Errors:**

| Status | Code                 | Body                                                                                         |
| ------ | -------------------- | -------------------------------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR     | `{ "error": "items: array must contain at least 1 element" }`                                |
| 401    | UNAUTHENTICATED      | `{ "error": "User not authenticated" }`                                                      |
| 403    | FORBIDDEN            | `{ "error": "User not authorised" }`                                                         |
| 409    | BRANCH_NOT_ACCEPTING | `{ "error": "BranchNotAcceptingOrders" }`                                                    |
| 409    | OUT_OF_STOCK         | `{ "error": "OutOfStock", "details": [{ "productId": 1, "requested": 3, "available": 1 }] }` |
| 409    | IDEMPOTENCY_CONFLICT | `{ "error": "IdempotencyConflict" }`                                                         |
| 409    | MINIMUM_NOT_MET      | `{ "error": "OrderBelowMinimum", "minimum": 5000 }`                                          |
| 503    | CORE_UNAVAILABLE     | `{ "error": "Core service unavailable" }`                                                    |

---

### 1.2 GET /api/restaurants/:restaurantId/branches/:branchId/orders

**List restaurant orders (paginated)**

**Headers:** `Cookie`

**Query Params:**

- `status` (comma-separated): `placed,accepted,preparing,ready,assigned,picked`
- `from` (ISO date): `2026-10-01`
- `to` (ISO date): `2026-10-16`
- `cursor`, `limit`, `sortBy`, `sortOrder`

**Auth:** `rbac({resource: 'orders', action: 'read'})` + `requireRestaurantMember` + `requireBranchAccess`

**Response 200 (paginated):**

```typescript
class OrderSummaryDTO {
  publicId: string;
  status: OrderStatus;
  total: number;
  itemsCount: number;
  customer: { id: number; name: string; phone: string };
  paymentMethod: 'online' | 'cod';
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
}
```

---

### 1.3 GET /api/restaurants/:restaurantId/branches/:branchId/orders/:orderId

**Get order detail**

**Auth:** Restaurant member (same branch) or customer (own order) or system admin

**Response 200:**

```typescript
class OrderDetailDTO extends OrderSummaryDTO {
  subtotal: number;
  deliveryFee: number;
  commission: number;
  branch: { id: number; name: string; lat: number; lng: number };
  customerAddress: { lat: number; lng: number; addressText: string };
  items: OrderItemResponseDTO[];
  paymentSummary: {
    method: 'online' | 'cod';
    status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
    amount: number;
    refundedAmount: number;
  };
  history: Array<{ status: OrderStatus; ts: string }>;
  delivery?: {
    id: number;
    status: DeliveryStatus;
    agent?: { id: number; name: string; phone: string; lastLat?: number; lastLng?: number; lastSeenAt?: string };
    assignedAt: string;
    acceptedAt?: string;
    pickedAt?: string;
    deliveredAt?: string;
  };
}
```

---

### 1.4 PATCH /api/restaurants/:restaurantId/branches/:branchId/orders/:orderId/status

**Update order status (restaurant)**

**Headers:** `Cookie`, `Idempotency-Key`

**Request Body:**

```typescript
class UpdateOrderStatusDTO {
  @IsEnum(OrderStatus)
  status: OrderStatus; // accepted, rejected, preparing, ready, cancelled

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

**Valid Transitions (Restaurant):**

| From        | To          | Action                                 |
| ----------- | ----------- | -------------------------------------- |
| `placed`    | `accepted`  | Restaurant accepts                     |
| `placed`    | `rejected`  | Restaurant rejects                     |
| `placed`    | `cancelled` | Restaurant cancels                     |
| `accepted`  | `preparing` | Kitchen starts                         |
| `accepted`  | `cancelled` | Restaurant cancels                     |
| `preparing` | `ready`     | Food ready                             |
| `preparing` | `cancelled` | Restaurant cancels                     |
| `ready`     | `cancelled` | Restaurant cancels (before assignment) |

**Response 200:**

```typescript
class OrderStatusResponseDTO {
  publicId: string;
  status: OrderStatus;
  updatedAt: string;
}
```

**Errors:**

| Status | Code               | Message                                        |
| ------ | ------------------ | ---------------------------------------------- |
| 409    | INVALID_TRANSITION | `Cannot transition from {from} to {to}`        |
| 409    | CANNOT_CANCEL      | `Order cannot be cancelled in status {status}` |

---

### 1.5 PATCH /api/customer/orders/:orderId/status

**Customer cancels order**

**Headers:** `Cookie`, `Idempotency-Key`

**Request Body:**

```typescript
class CustomerCancelDTO {
  @IsEnum(['cancelled'])
  status: 'cancelled';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
```

**Allowed:** `pending_payment` (anytime), `placed` (within 60s), `accepted`, `preparing`

**Response 200:** `OrderStatusResponseDTO`

---

### 1.6 GET /api/customer/orders

**Customer order history**

**Query:** `year` (optional, default current), `cursor`, `limit`, `sortBy=createdAt`, `sortOrder=desc`

**Response 200 (paginated):** `OrderSummaryDTO[]`

---

## 2. Payments

### 2.1 POST /api/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment/init

**Initialize Kashier payment session**

**Headers:** `Cookie`, `Idempotency-Key` (strict)

**Request Body:**

```typescript
class InitPaymentDTO {
  @IsOptional()
  @IsString()
  @IsUrl()
  redirectUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  cancelUrl?: string;
}
```

**Response 201:**

```typescript
class PaymentInitResponseDTO {
  sessionId: string; // Kashier session ID
  redirectUrl: string; // URL to redirect customer
  expireAt: string; // ISO 8601
}
```

**Errors:**

| Status | Code                 | Message                                                |
| ------ | -------------------- | ------------------------------------------------------ |
| 400    | INVALID_ORDER_STATUS | `Order must be in pending_payment to initiate payment` |
| 409    | PAYMENT_EXISTS       | `Payment already initiated for this order`             |
| 400    | AMOUNT_MISMATCH      | `Payment amount does not match order total`            |
| 502    | KASHIER_ERROR        | `Payment gateway error: {details}`                     |

---

### 2.2 GET /api/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment

**Get payment status**

**Response 200:**

```typescript
class PaymentResponseDTO {
  id: number;
  publicId: string;
  orderId: number;
  orderPublicId: string;
  provider: 'kashier' | 'cod';
  amount: number;
  currency: 'EGP';
  status: PaymentSessionStatus;
  method: string | null;
  createdAt: string;
  paidAt: string | null;
  transactions: TransactionSummaryDTO[];
}

class TransactionSummaryDTO {
  id: number;
  type: TransactionType;
  method: 'online' | 'cod' | 'bank_transfer' | 'system';
  status: 'pending' | 'succeeded' | 'failed' | 'reversed';
  amount: number;
  currency: 'EGP';
  providerReferenceId: string | null;
  createdAt: string;
}
```

---

### 2.3 POST /api/payments/webhook/kashier

**Kashier webhook (public, no auth)**

**Headers:** `x-kashier-signature`

**Body:** Kashier webhook payload

**Response:** `200 OK` (always, even for duplicates)

**Processing:**

1. Verify HMAC-SHA256 with `KASHIER_WEBHOOK_SECRET`
2. Insert into `payment_webhook_events` (unique on `provider_event_id`) — if conflict → return 200
3. Process event: `pay.SUCCESS` → order `placed`, `charge` transaction; `pay.FAILURE` → increment attempts

---

### 2.4 POST /api/payments/:paymentId/refund

**Request refund (admin/finance)**

**Headers:** `Cookie`, `Idempotency-Key` (strict)

**Request Body:**

```typescript
class RefundRequestDTO {
  @IsNumber()
  @Min(1)
  @Max(99999999)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
```

**Response 201:**

```typescript
class RefundResponseDTO {
  refundId: number;
  paymentId: number;
  amount: number;
  currency: 'EGP';
  status: 'pending';
  createdAt: string;
}
```

**Errors:**

| Status | Code                | Message                               |
| ------ | ------------------- | ------------------------------------- |
| 400    | REFUND_EXCEEDS_PAID | `Refund amount exceeds paid amount`   |
| 400    | REFUND_NOT_ALLOWED  | `Refund not allowed for order status` |
| 403    | FORBIDDEN           | `Insufficient permissions`            |

---

### 2.5 GET /api/restaurants/:restaurantId/payments

**List payments (restaurant admin)**

**Query:** `status`, `from`, `to`, `cursor`, `limit`

**Response 200 (paginated):** `PaymentResponseDTO[]`

---

## 3. Agents & Deliveries

### 3.1 POST /api/agents/presence/online

**Agent comes online**

**Headers:** `Cookie` (agent user)

**Request Body:**

```typescript
class PresenceOnlineDTO {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
```

**Response 200:**

```json
{ "success": true, "data": { "message": "Online", "ttl": 300 } }
```

**Errors:** 409 if agent has `picked` order

---

### 3.2 POST /api/agents/presence/ping

**Agent location ping (every 30s)**

**Headers:** `Cookie`

**Request Body:** `PresenceOnlineDTO`

**Response 200:** `{ "success": true }`

---

### 3.3 POST /api/agents/presence/offline

**Agent goes offline**

**Headers:** `Cookie`

**Response 200:** `{ "success": true }`

**Errors:** 409 `CannotGoOfflineWithPickedOrder` if agent has `picked` order

---

### 3.4 POST /api/agents/orders/:publicId/accept

**Agent accepts offered order**

**Headers:** `Cookie`

**Response 200:**

```typescript
class DeliveryTaskDTO {
  orderId: string;
  status: OrderStatus;
  branch: { id: number; name: string; lat: number; lng: number };
  customer: { name: string; phone: string; lat: number; lng: number; address: string };
  items: { name: string; quantity: number }[];
  assignedAt: string;
  pickedAt: string | null;
}
```

**Errors:** 409 `OrderAlreadyClaimed`, 409 `OfferExpired`

---

### 3.5 POST /api/agents/orders/:publicId/reject

**Agent rejects offered order**

**Headers:** `Cookie`

**Response 200:** `{ "success": true }`

---

### 3.6 PATCH /api/agents/orders/:publicId/status

**Agent updates delivery status**

**Headers:** `Cookie`

**Request Body:**

```typescript
class AgentStatusDTO {
  @IsEnum(['picked', 'delivered'])
  status: 'picked' | 'delivered';
}
```

**Valid:** `assigned` → `picked` → `delivered`

**Response 200:** `DeliveryTaskDTO`

---

### 3.7 GET /api/agents/tasks

**Agent's assigned tasks**

**Query:** `status` (comma-separated: `assigned,picked`), `cursor`, `limit`

**Response 200 (paginated):** `DeliveryTaskDTO[]`

---

### 3.8 GET /api/agents/earnings

**Agent earnings history**

**Query:** `from`, `to`, `cursor`, `limit`

**Response 200 (paginated):**

```typescript
class AgentEarningsDTO {
  id: number;
  orderId: string;
  amount: number; // minor units
  currency: 'EGP';
  earnedAt: string;
}
```

---

### 3.9 GET /api/agents/earnings/sum

**Agent earnings summary**

**Query:** `from`, `to`

**Response 200:**

```json
{ "success": true, "data": { "total": 150000, "currency": "EGP", "count": 42 } }
```

---

### 3.10 POST /api/admin/orders/:publicId/assign

**Admin override assignment**

**Headers:** `Cookie` (admin)

**Request Body:**

```typescript
class AssignAgentDTO {
  @IsInt()
  @Min(1)
  agentId: number;
}
```

**Response 200:** `DeliveryTaskDTO`

---

## 4. Restaurant Finance

### 4.1 GET /api/restaurants/:restaurantId/balance

**Current balance**

**Auth:** `rbac({resource: 'finance', action: 'read'})` + `requireRestaurantMember`

**Response 200:**

```typescript
class RestaurantBalanceDTO {
  restaurantId: number;
  balance: number; // minor units (EGP)
  currency: 'EGP';
  updatedAt: string;
}
```

---

### 4.2 GET /api/restaurants/:restaurantId/transactions

**Transaction history (paginated)**

**Query:** `type` (`charge,refund,commission,payout,cod_collection,adjustment`), `status`, `from`, `to`, `cursor`, `limit`

**Response 200 (paginated):**

```typescript
class TransactionDTO {
  id: number;
  orderId: number | null;
  orderPublicId: string | null;
  type: TransactionType;
  method: 'online' | 'cod' | 'bank_transfer' | 'system';
  status: 'pending' | 'succeeded' | 'failed' | 'reversed';
  amount: number;
  currency: 'EGP';
  providerReferenceId: string | null;
  description: string;
  createdAt: string;
}
```

---

### 4.3 GET /api/restaurants/:restaurantId/payouts

**Payout history**

**Query:** `from`, `to`, `cursor`, `limit`

**Response 200 (paginated):** `TransactionDTO[]` (filtered to `type='payout'`)

---

### 4.4 POST /api/admin/restaurants/:restaurantId/payouts

**Record payout (admin only)**

**Headers:** `Cookie`, `Idempotency-Key` (strict)

**Request Body:**

```typescript
class CreatePayoutDTO {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference: string; // bank transfer reference
}
```

**Response 201:**

```typescript
class PayoutResponseDTO {
  id: number;
  restaurantId: number;
  amount: number;
  currency: 'EGP';
  reference: string;
  status: 'succeeded';
  createdAt: string;
}
```

**Errors:**

| Status | Code                 | Message                                       |
| ------ | -------------------- | --------------------------------------------- |
| 409    | INSUFFICIENT_BALANCE | `Insufficient balance for payout`             |
| 409    | IDEMPOTENCY_CONFLICT | `Payout with this reference already recorded` |

---

## 5. WebSocket Events

### Connection

- Endpoint: `ws://host/ws`
- Auth: `auth: { token }` in handshake or `?token=` query or `access_token` cookie
- Client emits: `subscribe(channelName, ack)`, `unsubscribe(channelName)`

### Channels

| Channel                     | Subscribers           |
| --------------------------- | --------------------- |
| `customer:<userId>`         | The customer          |
| `restaurant:<restaurantId>` | Restaurant owners     |
| `branch:<branchId>`         | Branch staff/managers |
| `agent:<agentId>`           | The agent             |

### Events

| Channel                     | Event                  | Payload                                      |
| --------------------------- | ---------------------- | -------------------------------------------- |
| `customer:<userId>`         | `order.status_changed` | `{ orderId, status, agent?: {name, phone} }` |
| `customer:<userId>`         | `delivery.position`    | `{ orderId, lat, lng, timestamp }`           |
| `branch:<branchId>`         | `order.placed`         | `{ orderId, items[], customer }`             |
| `branch:<branchId>`         | `order.status_changed` | `{ orderId, status }`                        |
| `branch:<branchId>`         | `delivery.assigned`    | `{ orderId, agentId, agentName }`            |
| `agent:<agentId>`           | `task.offered`         | `{ orderId, branch, customer, expiresAt }`   |
| `agent:<agentId>`           | `offer.cancelled`      | `{ orderId, reason }`                        |
| `agent:<agentId>`           | `task.assigned`        | `{ orderId, branch, customer }`              |
| `agent:<agentId>`           | `task.cancelled`       | `{ orderId, reason }`                        |
| `restaurant:<restaurantId>` | `order.placed`         | `{ orderId, branchId }`                      |
| `restaurant:<restaurantId>` | `order.cancelled`      | `{ orderId, reason }`                        |

---

## Error Code Reference

| Code                          | Domain                    | HTTP | Description                                     |
| ----------------------------- | ------------------------- | ---- | ----------------------------------------------- |
| `VALIDATION_ERROR`            | All                       | 400  | Request body validation failed                  |
| `UNAUTHENTICATED`             | All                       | 401  | Missing/invalid token                           |
| `FORBIDDEN`                   | All                       | 403  | RBAC denial                                     |
| `NOT_FOUND`                   | All                       | 404  | Resource not found                              |
| `IDEMPOTENCY_CONFLICT`        | Orders, Payments, Finance | 409  | Key reused with different payload               |
| `BRANCH_NOT_ACCEPTING`        | Orders                    | 409  | Branch closed/not accepting                     |
| `OUT_OF_STOCK`                | Orders                    | 409  | Product stock insufficient                      |
| `MINIMUM_NOT_MET`             | Orders                    | 409  | Order below branch minimum                      |
| `INVALID_TRANSITION`          | Orders                    | 409  | Illegal status transition                       |
| `CANNOT_CANCEL`               | Orders                    | 409  | Cancellation not allowed in current status      |
| `CANCEL_WINDOW_EXPIRED`       | Orders                    | 409  | Customer cancel window (60s) passed             |
| `PAYMENT_EXISTS`              | Payments                  | 409  | Payment session already exists                  |
| `INVALID_ORDER_STATUS`        | Payments                  | 400  | Order not in `pending_payment`                  |
| `AMOUNT_MISMATCH`             | Payments                  | 400  | Payment amount ≠ order total                    |
| `SESSION_EXPIRED`             | Payments                  | 400  | Payment session expired                         |
| `WEBHOOK_INVALID_SIGNATURE`   | Payments                  | 401  | HMAC verification failed                        |
| `REFUND_EXCEEDS_PAID`         | Payments                  | 400  | Refund > paid - already_refunded                |
| `REFUND_NOT_ALLOWED`          | Payments                  | 400  | Order not `delivered` or payment not `captured` |
| `KASHIER_ERROR`               | Payments                  | 502  | Gateway returned error                          |
| `AGENT_NOT_ONLINE`            | Agent                     | 409  | Agent not in `presence:meta`                    |
| `AGENT_ALREADY_BUSY`          | Agent                     | 409  | Agent in `presence:busy`                        |
| `ORDER_NOT_READY`             | Agent                     | 409  | Order not `ready`                               |
| `ORDER_ALREADY_CLAIMED`       | Agent                     | 409  | `claim:order` already set                       |
| `OFFER_EXPIRED`               | Agent                     | 409  | `offer:order` TTL expired                       |
| `MAX_ATTEMPTS_EXCEEDED`       | Agent                     | 409  | `assign:attempts` ≥ 3                           |
| `INVALID_AGENT_TRANSITION`    | Agent                     | 409  | Illegal agent status transition                 |
| `INSUFFICIENT_BALANCE`        | Finance                   | 409  | Payout > restaurant balance                     |
| `PAYOUT_IDEMPOTENCY_CONFLICT` | Finance                   | 409  | Duplicate payout reference                      |
| `CORE_UNAVAILABLE`            | Orders                    | 503  | Core-service sync call failed                   |
