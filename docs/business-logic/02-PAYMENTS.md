# Business Logic — Payments

## Payment Flow (Kashier Payment Sessions)

```
1. Order Created (paymentMethod='online') → Order Service publishes `order.created`
2. Payment Service receives → Creates Kashier Payment Session
3. Returns `redirectUrl` to frontend (in OrderResponseDTO.payment)
4. Customer pays on Kashier hosted page / iframe
5. Kashier sends webhook → Payment Service verifies HMAC signature
6. Webhook handler updates payment status, publishes `payment.completed` / `payment.failed`
7. Order Service receives → Updates order status to `placed`
8. Agent Service receives `order.placed` → Adds to assignment queue
```

### Key Rules

- One PaymentSession per Order (1:1)
- Payment amount = Order.total (immutable after creation)
- Payment session expires at `expireAt` (default 15 min from `PAYMENT_SESSION_TIMEOUT_MIN`)
- Manual capture: `false` (auto-capture on success)
- Webhook verification: HMAC-SHA256 with `KASHIER_WEBHOOK_SECRET`
- Idempotency: key on `(provider_id, provider_event_id)` from webhook + `payment_webhook_events` unique constraint
- Refunds: full or partial, via Kashier API (requires secret key)

### Payment Methods

| Method           | Code     | Description                          |
| ---------------- | -------- | ------------------------------------ |
| Online           | `online` | Kashier (card, wallet, installments) |
| Cash on Delivery | `cod`    | Collected by agent at delivery       |

---

## Kashier Integration

### Configuration (env)

```env
KASHIER_BASE_URL=https://test-api.kashier.io          # or https://api.kashier.io for live
KASHIER_MERCHANT_ID=MID-XXXX-XXXX
KASHIER_API_KEY=pk_test_xxx
KASHIER_SECRET_KEY=sk_test_xxx
KASHIER_WEBHOOK_SECRET=whsec_xxx                       # for HMAC verification
KASHIER_RETURN_URL=https://app.example.com/checkout/return
KASHIER_FAIL_URL=https://app.example.com/checkout/failed
PAYMENT_SESSION_TIMEOUT_MIN=15
```

### KashierClient (pkg/payments/kashier/)

```typescript
// pkg/payments/payment.interface.ts
export interface IPaymentProvider {
  createSession(params: CreateSessionParams): Promise<CreateSessionResponse>;
  getSession(sessionId: string): Promise<SessionDetails>;
  refundOrder(orderId: string, amount: number, reason: string): Promise<RefundResponse>;
  verifyWebhookSignature(payload: any, signature: string): boolean;
}

// pkg/payments/kashier/kashier.client.ts
class KashierClient implements IPaymentProvider {
  // POST /v3/payment/sessions
  async createSession(params: CreateSessionParams) { ... }

  // GET /v3/payment/sessions/{sessionId}/payment
  async getSession(sessionId: string) { ... }

  // PUT /v3/orders/{orderId} (apiOperation=REFUND)
  async refundOrder(orderId: string, amount: number, reason: string) { ... }

  // HMAC-SHA256 verification per Kashier docs
  static verifyWebhookSignature(payload: any, signature: string, secret: string): boolean { ... }
}
```

### Create Session Params

```typescript
interface CreateSessionParams {
  orderId: string; // our order public_id (UUID)
  amount: number; // order.total (minor units)
  currency: string; // 'EGP'
  customer: { email: string; reference: string }; // user.email, user.id
  merchantRedirect: string; // KASHIER_RETURN_URL
  serverWebhook: string; // our webhook endpoint /api/payments/webhook/kashier
  expireAt: string; // ISO 8601, now + PAYMENT_SESSION_TIMEOUT_MIN
  description: string; // `Order ${orderPublicId}`
  metadata: {
    restaurantId: number;
    branchId: number;
    orderId: number; // internal bigint id
  };
}
```

---

## Webhook Handling

### Endpoint

```
POST /api/payments/webhook/kashier
Headers: x-kashier-signature
Body: { event: string, data: WebhookData }
```

**No authentication middleware** — verified via HMAC.

### Event Types to Handle

| Event                       | Data Status | Action                                                                             |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `pay`                       | `SUCCESS`   | Mark payment `captured`, insert `transactions(charge/succeeded)`, order → `placed` |
| `pay`                       | `FAILURE`   | Increment `failure_attempts`, if >= max → `failed`, order stays `pending_payment`  |
| `pay`                       | `PENDING`   | Mark payment `pending`                                                             |
| `authorize`                 | `SUCCESS`   | Mark payment `authorized` (if manualCapture=true)                                  |
| `capture`                   | `SUCCESS`   | Update captured amount                                                             |
| `refund` / `partial_refund` | `SUCCESS`   | Update refunded amount, mark refund `succeeded`                                    |
| `refund` / `partial_refund` | `FAILURE`   | Mark refund `failed`                                                               |
| `void`                      | `SUCCESS`   | Mark payment `cancelled`                                                           |
| `reject`                    | `FAILURE`   | Mark payment `failed`                                                              |
| `reversal`                  | `SUCCESS`   | Mark payment `reversed`                                                            |

### Webhook Handler Logic

```typescript
async handleKashierWebhook(req: Request, res: Response) {
  // 1. Verify HMAC signature
  const signature = req.headers['x-kashier-signature'];
  if (!KashierClient.verifyWebhookSignature(req.body, signature, env.KASHIER_WEBHOOK_SECRET)) {
    logger.warn('Invalid Kashier webhook signature');
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;

  // 2. Idempotency: insert into payment_webhook_events (unique on provider_event_id)
  const inserted = await paymentWebhookEventRepo.tryInsert({
    provider_id: KASHIER_PROVIDER_ID,
    provider_event_id: data.transactionId,  // or Kashier's event ID
    signature,
    payload: req.body,
  });
  if (!inserted) {
    return res.status(200).send('OK');  // duplicate, ack to stop retries
  }

  // 3. Find payment session
  const session = await paymentSessionRepo.findByProviderSessionId(data.kashierOrderId);
  if (!session) {
    logger.warn('Payment session not found for webhook', { orderRef: data.orderReference });
    return res.status(404).send('Session not found');
  }

  // 4. Process event in transaction
  const trx = await db.transaction();
  try {
    await this.processWebhookEvent(session, event, data, trx);
    await paymentWebhookEventRepo.markProcessed(data.transactionId, trx);
    await trx.commit();
    res.status(200).send('OK');
  } catch (e) {
    await trx.rollback();
    await paymentWebhookEventRepo.markError(data.transactionId, e.message, trx);
    throw e;
  }
}
```

### Process Event Details

```typescript
async processWebhookEvent(session, event, data, trx) {
  switch (event) {
    case 'pay':
      if (data.status === 'SUCCESS') {
        // Update session
        await paymentSessionRepo.update(session.id, {
          status: 'captured',
          provider_reference_id: data.transactionId,
          raw_last_payload: data,
          updated_at: new Date(),
        }, trx);

        // Insert transaction
        await transactionRepo.insert({
          order_id: session.order_id,
          transaction_type: 'charge',
          method: 'online',
          provider_id: session.provider_id,
          provider_reference_id: data.transactionId,
          status: 'succeeded',
          amount: data.amount,
          currency: data.currency,
          src_acc_id: data.customer?.reference ? Number(data.customer.reference) : null,
          dst_acc_id: null,  // platform receives
          idempotency_key: `charge:${data.transactionId}`,
        }, trx);

        // Update order status
        await orderRepo.updateStatus(session.order_id, 'placed', trx);

        // Publish event
        await eventBus.publish('order.placed', { orderId: session.order_id, ... });
      } else if (data.status === 'FAILURE') {
        const attempts = session.failure_attempts + 1;
        await paymentSessionRepo.update(session.id, {
          status: attempts >= session.max_failure_attempts ? 'failed' : 'pending',
          failure_attempts: attempts,
          raw_last_payload: data,
        }, trx);
      }
      break;

    case 'refund':
    case 'partial_refund':
      if (data.status === 'SUCCESS') {
        await transactionRepo.updateByProviderRef(data.transactionId, {
          status: 'succeeded',
        }, trx);
        // Original charge marked refunded
        await transactionRepo.markRefunded(data.transactionId, trx);
      }
      break;

    case 'void':
      if (data.status === 'SUCCESS') {
        await paymentSessionRepo.update(session.id, { status: 'cancelled' }, trx);
        await transactionRepo.updateByProviderRef(data.transactionId, {
          status: 'reversed',
        }, trx);
        await orderRepo.updateStatus(session.order_id, 'cancelled', trx);
      }
      break;
  }
}
```

---

## COD (Cash on Delivery) Flow

1. Order created with `payment_method='cod'`, status → `placed` immediately
2. `transactions` row inserted: `type='cod_collection'`, `status='pending'`, `amount=order.total`
3. At `delivered` transition (Agent):
   - Same trx: update transaction to `succeeded`
   - Insert `transactions(commission)` if applicable
   - Update `restaurant_balances`
   - Insert `agent_earnings`

---

## Refund Flow

```
1. Admin POST /api/payments/{paymentId}/refund { amount, reason }
2. Validate: order delivered, amount <= paid - already_refunded
3. Call KashierClient.refundOrder(kashierOrderId, amount, reason)
4. Insert transactions(type='refund', status='pending', idempotency_key='refund:{paymentId}:{amount}')
5. On webhook refund.SUCCESS → transaction.status='succeeded', charge.is_refunded=true
6. On webhook refund.FAILURE → transaction.status='failed'
```

---

## API Endpoints

| Method | Path                                                                           | Auth              | Description                                          |
| ------ | ------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------- |
| POST   | /api/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment/init | ✓                 | Create Kashier session (if not done at order create) |
| GET    | /api/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment      | ✓                 | Get payment status                                   |
| POST   | /api/payments/webhook/kashier                                                  | ✗ (HMAC)          | Kashier webhook                                      |
| POST   | /api/payments/:paymentId/refund                                                | ✓ (admin/finance) | Request refund                                       |
| GET    | /api/restaurants/:restaurantId/payments                                        | ✓                 | List payments (restaurant admin)                     |

---

## DTOs

### InitPaymentRequestDTO

```typescript
class InitPaymentRequestDTO {
  @IsOptional() @IsString() @IsUrl() redirectUrl?: string;
  @IsOptional() @IsString() cancelUrl?: string;
}
```

### RefundRequestDTO

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

### PaymentInitResponseDTO

```typescript
class PaymentInitResponseDTO {
  sessionId: string; // Kashier session ID
  redirectUrl: string; // URL to redirect customer
  expireAt: string; // ISO 8601
}
```

### PaymentResponseDTO

```typescript
class PaymentResponseDTO {
  id: number;
  publicId: string;
  orderId: number;
  orderPublicId: string;
  provider: 'kashier' | 'cod';
  amount: number;
  currency: string;
  status: PaymentSessionStatus;
  method: string | null;
  createdAt: string;
  paidAt: string | null;
  transactions: TransactionSummaryDTO[];
}
```

---

## Service Methods

### PaymentService

```typescript
class PaymentService {
  // Session management
  async initPayment(orderId: number, dto: InitPaymentRequestDTO): Promise<PaymentInitResponseDTO>;
  async getPaymentByOrder(orderId: number): Promise<PaymentResponseDTO>;
  async verifyPaymentManually(sessionId: string): Promise<void>; // fallback polling

  // Refunds
  async requestRefund(paymentId: number, userId: number, dto: RefundRequestDTO): Promise<RefundResponseDTO>;
  async processRefundWebhook(data: KashierWebhookData, trx: Knex): Promise<void>;

  // Webhook
  async handleKashierWebhook(payload: any, signature: string): Promise<void>;

  // Reconciliation
  async reconcileOrderPayments(orderId: number): Promise<void>;
}
```

---

## Events Published (In-Process)

| Event               | Payload                                                      | Consumers                        |
| ------------------- | ------------------------------------------------------------ | -------------------------------- |
| `payment.initiated` | { paymentSessionId, orderId, redirectUrl, expireAt }         | Frontend (via OrderResponse)     |
| `payment.completed` | { paymentSessionId, orderId, transactionId, amount, method } | Order (→ placed), Agent (queue)  |
| `payment.failed`    | { paymentSessionId, orderId, reason, attempts }              | Order (notify), Frontend         |
| `payment.refunded`  | { paymentSessionId, orderId, refundId, amount }              | Order (update), Finance (ledger) |
| `payment.voided`    | { paymentSessionId, orderId, transactionId }                 | Order (cancel), Finance          |

---

## Repository Interface

```typescript
interface PaymentSessionRepository {
  COLUMNS: string[];
  create(data: Partial<PaymentSessionEntity>, trx?: Knex): Promise<PaymentSessionEntity>;
  findById(id: number, conn?: Knex): Promise<PaymentSessionEntity | undefined>;
  findByOrderId(orderId: number, conn?: Knex): Promise<PaymentSessionEntity | undefined>;
  findByProviderSessionId(providerSessionId: string, conn?: Knex): Promise<PaymentSessionEntity | undefined>;
  update(id: number, data: Partial<PaymentSessionEntity>, trx?: Knex): Promise<void>;
}

interface TransactionRepository {
  COLUMNS: string[];
  create(data: Partial<TransactionEntity>, trx?: Knex): Promise<TransactionEntity>;
  findByOrderId(orderId: number, conn?: Knex): Promise<TransactionEntity[]>;
  findByProviderReferenceId(providerRef: string, conn?: Knex): Promise<TransactionEntity | undefined>;
  updateByProviderRef(providerRef: string, data: Partial<TransactionEntity>, trx?: Knex): Promise<void>;
  markRefunded(providerRef: string, trx?: Knex): Promise<void>;
  findPayouts(restaurantId: number, from: Date, to: Date, conn?: Knex): Promise<TransactionEntity[]>;
}

interface PaymentWebhookEventRepository {
  tryInsert(
    data: { provider_id: number; provider_event_id: string; signature: string; payload: any },
    trx?: Knex,
  ): Promise<boolean>;
  markProcessed(providerEventId: string, trx?: Knex): Promise<void>;
  markError(providerEventId: string, error: string, trx?: Knex): Promise<void>;
}
```

---

## Entity Classes

```typescript
export enum PaymentSessionStatus {
  INITIALIZED = 'initialized',
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export class PaymentSessionEntity {
  id: number;
  orderId: number;
  providerId: number;
  providerSessionId: string;
  redirectUrl: string;
  amount: number;
  currency: string;
  status: PaymentSessionStatus;
  rawInitPayload: any;
  rawLastPayload: any | null;
  failureAttempts: number;
  maxFailureAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  constructor(data: Partial<PaymentSessionEntity>) {
    /* assign */
  }
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

## Validation Rules

1. **Init Payment**
   - Order exists, belongs to restaurant/branch
   - Order status = `pending_payment`
   - No existing payment session (or existing is `expired`/`failed`/`cancelled`)
   - Amount matches order.total

2. **Refund Request**
   - Order status = `delivered`
   - Payment status = `captured` (or `succeeded` for COD)
   - Refund amount ≤ (paidAmount - alreadyRefunded)
   - User has `payments:refund` permission

3. **Webhook**
   - HMAC signature must verify
   - `provider_event_id` not already processed (unique constraint)
   - `orderReference` matches existing payment session

---

## Error Codes

| Code                              | HTTP | Message                                              |
| --------------------------------- | ---- | ---------------------------------------------------- |
| PAYMENT_SESSION_NOT_FOUND         | 404  | Payment session not found                            |
| PAYMENT_ALREADY_EXISTS            | 409  | Payment already initiated for this order             |
| PAYMENT_ORDER_INVALID_STATUS      | 400  | Order must be in pending_payment to initiate payment |
| PAYMENT_AMOUNT_MISMATCH           | 400  | Payment amount does not match order total            |
| PAYMENT_SESSION_EXPIRED           | 400  | Payment session has expired                          |
| PAYMENT_WEBHOOK_INVALID_SIGNATURE | 401  | Invalid webhook signature                            |
| PAYMENT_WEBHOOK_DUPLICATE         | 200  | Webhook already processed (acked)                    |
| PAYMENT_REFUND_EXCEEDS_PAID       | 400  | Refund amount exceeds paid amount                    |
| PAYMENT_REFUND_NOT_ALLOWED        | 400  | Refund not allowed for order status                  |
| PAYMENT_KASHIER_ERROR             | 502  | Payment gateway error: {details}                     |
| PAYMENT_PROVIDER_DISABLED         | 409  | Payment provider not available                       |

---

## Idempotency Strategy

- **Webhooks**: `payment_webhook_events` unique on `(provider_id, provider_event_id)` — insert with `ON CONFLICT DO NOTHING`
- **Refunds**: `transactions.idempotency_key` unique — `refund:{paymentId}:{amount}`
- **Charges**: `transactions.idempotency_key` unique — `charge:{kashierTransactionId}`
- **COD Collection**: `transactions.idempotency_key` unique — `cod-collect:{orderPublicId}`

All critical writes use the unique constraint as the source of truth. Redis idempotency middleware handles the fast path for `POST /orders` and `POST /payments/init`.
