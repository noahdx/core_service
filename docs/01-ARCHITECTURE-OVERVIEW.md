# System Architecture Overview (Modular Monolith)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API Gateway (Express)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/auth     /api/user     /api/restaurant     /api/branch                │
│  /api/product  /api/address   /api/order         /api/payment               │
│  /api/agent    /api/finance   /api/rbac          /api/health                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │   Order      │ │  Payment     │ │   Agent      │
           │   Domain     │ │  Domain      │ │  Domain      │
           └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
           ┌────────┴────────┐ ┌────┴────────┐ ┌───┴────────┐
           │  Finance       │ │  Kashier    │ │  Delivery  │
           │  Domain        │ │  Integration│ │  Tracking  │
           └────────────────┘ └─────────────┘ └────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │   Single Postgres   │
                         │   (shared DB)       │
                         └─────────────────────┘
```

## Domain Boundaries

| Domain      | Responsibility                                                        | Key Entities                           |
| ----------- | --------------------------------------------------------------------- | -------------------------------------- |
| **Order**   | Order lifecycle, items, status transitions, restaurant/branch context | Order, OrderItem, OrderStatus          |
| **Payment** | Payment sessions, webhooks, refunds, reconciliation with Kashier      | PaymentSession, Transaction, Refund    |
| **Agent**   | Delivery agent management, assignment, tracking, earnings             | Agent, Delivery, AgentEarnings         |
| **Finance** | Settlements, payouts, commissions, financial reporting                | Settlement, Payout, Commission, Ledger |

## Cross-Domain Communication (In-Process)

- **Direct Service Calls**: OrderService → PaymentService.init(), OrderService → AgentService.assign()
- **Events (in-process)**: OrderCreated → PaymentInitiated, OrderPaid → AgentAssigned
- **Shared Kernels**: Restaurant, Branch, User (read via repositories, not HTTP)
- **Anti-Corruption Layer**: KashierClient wraps external API

## Database Design Principles

- Each domain owns its tables
- Foreign keys within domain or to shared kernels (restaurant, branch, user)
- No direct cross-domain FKs — use service calls or domain events
- Soft deletes for audit trails (deleted_at)
- **Single country platform**: No currency or country fields needed across models.
- **Money stored as INT minor units** (e.g. piasters) — exact arithmetic.
- **Fee structure**: `total = subtotal + delivery_fee`. No service fee. Platform commission tracked per order.

## Security

- All endpoints: `authenticate` → `requireRestaurantMember` → `rbac`
- Payment webhooks: HMAC-SHA256 signature verification
- Idempotency keys on all mutating endpoints

## Tech Stack (Locked)

| Concern    | Library / Tool                                          |
| ---------- | ------------------------------------------------------- |
| Runtime    | Node.js + TypeScript (strict, decorators on)            |
| HTTP       | `express` v5                                            |
| Validation | `class-validator` + `class-transformer`                 |
| DI         | `tsyringe` (singletons via `TOKENS` symbols)            |
| Env        | `zod`                                                   |
| DB         | `knex` over `pg`                                        |
| Cache      | `ioredis` via `RedisCacheProvider`                      |
| Auth       | `jsonwebtoken` (access in cookie)                       |
| Password   | `bcrypt`                                                |
| Email      | `node-mailjet`                                          |
| IDs        | `uuid` v4 for public-facing IDs; bigserial for internal |
| Payments   | Kashier v3 (Payment Sessions + Webhooks)                |
