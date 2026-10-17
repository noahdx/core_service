# QuickBite — Backend API

Backend API for a modern food delivery platform built with **Node.js, Express 5, TypeScript, and PostgreSQL**.

The project follows a **modular monolith** layered architecture. It handles restaurant onboarding, branch management, product catalogs with per-branch inventory and pricing, customer delivery addresses, atomic order checkouts, online payment processing with Kashier, delivery agent tracking, restaurant balance and payout ledgers, role-based access control (RBAC), idempotency, and transactional emails.

---

## Table of Contents

- [Main Features](#main-features)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Project Structure](#project-structure)
- [Authentication & Security](#authentication--security)
- [Authorization (RBAC)](#authorization-rbac)
- [Order Lifecycle & State Machine](#order-lifecycle--state-machine)
- [Payment Gateway & Webhooks](#payment-gateway--webhooks)
- [Delivery Agent Dispatch](#delivery-agent-dispatch)
- [Restaurant Finance & Payouts](#restaurant-finance--payouts)
- [Idempotency](#idempotency)
- [Email Delivery](#email-delivery)
- [API Overview](#api-overview)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Useful Commands](#useful-commands)
- [Design Decisions](#design-decisions)

---

## Main Features

- **Authentication & Security**: Email/password authentication, JWT access and refresh tokens stored in secure `httpOnly` cookies, password hashing with bcrypt, Helmet headers, CORS policies, and request correlation IDs (`x-request-id`).
- **Transactional Emails**: Mailjet integration for password reset and restaurant member invitations with OTP tokens and HTML templates.
- **Restaurant & Branch Management**: Restaurant self-onboarding with owner creation, admin approval workflow, and multi-branch management.
- **Geospatial Discovery (PostGIS)**: Spatial index searches for nearby branches within custom delivery radii using `ST_DWithin`.
- **Product & Inventory Catalog**: Hierarchical categories and products with branch-specific prices, stocks, and live availability overrides.
- **Customer Address Book**: Delivery addresses with geospatial coordinates and default address management.
- **Fine-Grained RBAC**: Clear separation between system roles and restaurant staff roles with permission-based route guards and branch scoping.
- **Order Checkout & State Machine**: Atomic inventory reservation inside PostgreSQL transactions, support for cash-on-delivery and online payments, status progression, and cancellation with reason logging.
- **Kashier Payment Gateway**: Hosted checkout sessions, cryptographically verified webhooks (HMAC SHA-256), payment tracking, and refund requests.
- **Delivery Agent Shift & Dispatch**: Shift check-in/out, live GPS location pinging, order assignment, task status updates, and agent earnings tracking.
- **Restaurant Finance & Payouts**: Automated balance tracking, platform commission calculation, immutable ledger history, and payout requests with admin settlement.
- **Idempotency Engine**: Redis-backed idempotency middleware preventing duplicate operations on sensitive write requests (`POST`, `PUT`, `PATCH`).
- **Database Migrations**: Knex database schema migrations.

---

## Tech Stack

| Component           | Technology                | Description                                |
| ------------------- | ------------------------- | ------------------------------------------ |
| **Runtime**         | Node.js (v20+)            | Server-side JavaScript runtime             |
| **Language**        | TypeScript                | Statically typed application code          |
| **Framework**       | Express 5                 | Fast, unopinionated web framework          |
| **Database**        | PostgreSQL                | Primary relational database                |
| **Geospatial**      | PostGIS                   | Spatial queries and distance calculations  |
| **Query Builder**   | Knex.js                   | SQL query builder with migrations          |
| **Cache & Store**   | Redis / ioredis           | Idempotency storage and response caching   |
| **DI Container**    | tsyringe                  | Lightweight dependency injection container |
| **Payment Gateway** | Kashier                   | Online card payment and webhooks           |
| **Email Service**   | Mailjet (`node-mailjet`)  | Transactional emails and invitation OTPs   |
| **Validation**      | class-validator, Zod      | Request validation and environment schemas |
| **Security**        | Helmet, CORS, bcrypt, JWT | Headers, authentication, and password hash |

---

## Project Architecture

The application follows a clean **layered architecture** inside a modular monolith:

```text
HTTP Request
     │
     ▼
Route / Middleware  ─── (Authentication, RBAC, Idempotency, Validation)
     │
     ▼
Controller          ─── (HTTP request parsing, formats JSON response)
     │
     ▼
Service             ─── (Business rules, transactions, orchestration)
     │
     ▼
Repository          ─── (SQL queries via Knex, explicit column projection)
     │
     ▼
PostgreSQL / Redis
```

### Architectural Principles

1. **Clear Separation of Concerns**: Controllers only handle HTTP mechanics. Services own business rules and transactions. Repositories isolate database queries.
2. **Dependency Injection**: Services and repositories are registered with `tsyringe` and resolved through typed tokens.
3. **Explicit Data Contracts**: Incoming payloads are validated via Request DTOs. Outgoing payloads are formatted via Response DTOs.
4. **Resilience by Design**: Multi-step write operations execute inside Knex database transactions with rollback support.

---

## Project Structure

```text
src/
├── app/
│   ├── auth/                 # User registration, login, refresh, password reset
│   ├── user/                 # User profile management
│   ├── customer-address/     # Customer delivery addresses
│   ├── restaurant/           # Restaurant onboarding, approval, settings
│   ├── branch/               # Restaurant branches, PostGIS nearby lookup
│   ├── product/              # Categories, products, branch pricing & stock
│   ├── rbac/                 # Restaurant staff, roles, permissions
│   ├── order/                # Order checkout, lifecycle, cancellation
│   ├── payment/              # Kashier checkout sessions, webhooks, refunds
│   ├── agent/                # Delivery agent shifts, location ping, delivery flow
│   ├── finance/              # Restaurant balance, ledger, payout requests
│   └── health/               # Database and service health check
│
├── lib/
│   ├── auth/                 # JWT utilities, authenticate & RBAC middleware
│   ├── cache/                # Redis cache middleware
│   ├── config/               # Zod-validated environment config
│   ├── correlation/          # AsyncLocalStorage request correlation ID tracking
│   ├── di/                   # tsyringe container registration & tokens
│   ├── email/                # Email dispatcher utilities and interfaces
│   ├── error/                # AppError class and global error handler
│   ├── http/                 # Pagination, query parsing, and response helpers
│   ├── idempotency/          # Redis-backed idempotency middleware
│   ├── knex/                 # Knex database connection and configuration
│   ├── logger/               # Structured logging
│   ├── types/                # Shared global interfaces and types
│   ├── utils/                # Common utility functions (hash, JWT, cookie, time)
│   └── validation/           # class-validator body validation middleware
│
├── pkg/
│   ├── cache/                # Redis cache provider and interface
│   ├── email/                # Mailjet email provider and interface
│   ├── payments/             # Kashier payment gateway integration and interface
│   └── utils/                # Utility helpers (e.g. time conversion)
│
├── migrations/               # Knex database schema migrations
├── app.ts                    # Express application setup and middleware
├── routes.ts                 # Master router mounting all domain routers
└── server.ts                 # HTTP server bootstrap
```

### Domain Module Structure

Each domain under `src/app/<domain>` is self-contained:

```text
<domain>/
├── controller/               # Request handlers
├── service/                  # Business logic and transaction orchestration
├── repository/               # Database queries with explicit COLUMNS
├── dto/                      # Request DTOs (req.dto.ts) and Response DTOs (res.dto.ts)
├── entity/                   # Strongly-typed domain model entities
├── types.ts                  # Domain interfaces, types, and enums
├── errors.ts                 # Domain-specific AppError definitions
└── routes.ts                 # Express route definitions with middleware
```

---

## Authentication & Security

Authentication is based on JSON Web Tokens (JWT) stored in secure cookies:

- `access_token`: Short-lived token used to authenticate API requests (default: 1 hour).
- `refresh_token`: Long-lived token used to issue new access tokens (default: 7 days).

### Cookies Configuration

Tokens are issued as `httpOnly` cookies with `sameSite: lax` and `secure: true` in production.

### Context Propagation

The `authenticate` middleware decodes the access token and populates `req.user`:

```ts
interface AuthContext {
  userId: number;
  email: string;
  role: SystemRole;
  restaurantId?: number;
  restaurantRole?: string;
  branchIds?: number[];
}
```

---

## Authorization (RBAC)

The system enforces a dual-layer role-based access control architecture:

### 1. System Roles

High-level platform actor types:

- `system_admin`: Platform administrators with full system access.
- `customer`: End-users who place orders and manage delivery addresses.
- `restaurant_user`: Restaurant owners and staff members.
- `delivery_agent`: Delivery drivers who pick up and deliver orders.

### 2. Restaurant Staff Roles

Restaurant-scoped roles assigned to members:

- `owner`: Full control over the restaurant and all branches.
- `branch_manager`: Assigned to specific branches; manages branch menu, stock, and orders.
- `staff`: Branch-level operations (e.g., preparing orders).

### 3. Permissions

Granular permissions follow the `resource:action` pattern:

- `core:product:create`, `core:product:read`, `core:product:update`, `core:product:delete`
- `core:order:read`, `core:order:update`, `core:order:cancel`
- `core:member:create`, `core:member:read`, `core:member:update`, `core:member:delete`
- `core:finance:read`

Route guards ensure multi-tenant security:

```ts
router.get(
  '/branches/:branchId/orders',
  authenticate,
  requireBranchAccess('branchId'),
  rbac({ resource: 'core:order', action: 'read' }),
  orderController.listBranchOrders,
);
```

---

## Order Lifecycle & State Machine

Order processing uses atomic PostgreSQL transactions to prevent overselling:

```text
[Customer Checkout]
        │
        ├── Online Payment ──► PENDING_PAYMENT ──► (Kashier Webhook) ──► PLACED
        │
        └── Cash on Delivery ─────────────────────────────────────────► PLACED
                                                                          │
                                                                          ▼
                                                                      ACCEPTED
                                                                          │
                                                                          ▼
                                                                      PREPARING
                                                                          │
                                                                          ▼
                                                                  READY_FOR_PICKUP
                                                                          │
                                                                          ▼
                                                                  OUT_FOR_DELIVERY
                                                                          │
                                                                          ▼
                                                                      DELIVERED
```

- Any state prior to `OUT_FOR_DELIVERY` can transition to `CANCELLED` by authorized users with a mandatory reason.
- If an order is cancelled or payment fails, reserved inventory is automatically released.

---

## Payment Gateway & Webhooks

The platform integrates with the **Kashier** payment gateway:

1. **Session Initialization**: Generates a secure hosted checkout URL and cryptographic payment hash.
2. **Webhook Verification**: Validates the incoming webhook payload using HMAC SHA-256 with the shared secret.
3. **Transaction Settlement**: On successful payment, the order state advances to `placed` and a ledger entry is recorded.
4. **Refund Processing**: Supports full and partial refund requests with audit records.

---

## Delivery Agent Dispatch

Delivery drivers operate through a dedicated workflow:

1. **Shift Management**: Drivers go `online`, `busy`, or `offline`.
2. **GPS Ping**: Active drivers report periodic latitude and longitude coordinates.
3. **Task Assignment**: Orders in `ready_for_pickup` are assigned to available agents (manually by admin or auto-dispatch).
4. **Order Progression**: Drivers accept or reject assignments, mark orders as `out_for_delivery`, and confirm `delivered`.
5. **Earnings Tracking**: Real-time summary and detailed calculation of delivery fees per shift.

---

## Restaurant Finance & Payouts

An immutable financial ledger records restaurant earnings:

- **Net Earning Calculation**: `net_amount = subtotal - commission_amount`.
- **Commission Rates**: Branch-level configurable commission rate in basis points (`bps`).
- **Ledger Records**: Each delivered order records a positive credit to the restaurant balance.
- **Payout Requests**: Restaurant owners can view available balances and request payouts.
- **Admin Settlement**: Admins review, approve, and record payout settlements.

---

## Idempotency

Sensitive mutation operations are protected using Redis idempotency middleware:

- Applies to write methods (`POST`, `PUT`, `PATCH`).
- Clients provide an `Idempotency-Key` header (e.g., UUID v4).
- The middleware locks the key during processing and stores the resulting HTTP status and payload for **24 hours**.
- Concurrent duplicate requests receive `409 Conflict`.
- Subsequent identical requests return the cached response immediately.

```ts
router.post('/orders', authenticate, idempotency({ strict: true }), orderController.placeOrder);
```

---

## Email Delivery

Email sending is decoupled through an `IEmailProvider` interface:

```text
Service ──► IEmailProvider ──► MailjetEmailProvider ──► Mailjet API
```

### Templates

Templates are isolated from service code:

- `src/app/auth/templates/password-reset.ts`
- `src/app/rbac/templates/password-reset.ts`

---

## API Overview

Base URL: `http://localhost:3000/api`

### Health Check

| Method | Endpoint  | Description                        | Access |
| ------ | --------- | ---------------------------------- | ------ |
| `GET`  | `/health` | Check database connectivity & ping | Public |

### Authentication

| Method | Endpoint                | Description                         | Access |
| ------ | ----------------------- | ----------------------------------- | ------ |
| `POST` | `/auth/register`        | Register customer or restaurant     | Public |
| `POST` | `/auth/login`           | Login and receive auth cookies      | Public |
| `POST` | `/auth/refresh`         | Refresh access token via cookie     | Public |
| `POST` | `/auth/forget-password` | Request password reset OTP          | Public |
| `POST` | `/auth/reset-password`  | Reset password using OTP            | Public |
| `POST` | `/auth/accept-invite`   | Accept staff invitation and set pwd | Public |

### Users

| Method  | Endpoint            | Description                | Access        |
| ------- | ------------------- | -------------------------- | ------------- |
| `GET`   | `/user/profile/:id` | Get user profile           | Authenticated |
| `PATCH` | `/user/profile/:id` | Update profile information | Authenticated |

### Customer Addresses

| Method   | Endpoint       | Description                   | Access   |
| -------- | -------------- | ----------------------------- | -------- |
| `GET`    | `/address`     | List customer saved addresses | Customer |
| `GET`    | `/address/:id` | Get single address by ID      | Customer |
| `POST`   | `/address`     | Create new delivery address   | Customer |
| `PATCH`  | `/address/:id` | Update delivery address       | Customer |
| `DELETE` | `/address/:id` | Delete delivery address       | Customer |

### Restaurants

| Method  | Endpoint                           | Description                    | Access        |
| ------- | ---------------------------------- | ------------------------------ | ------------- |
| `GET`   | `/restaurant`                      | List paginated restaurants     | Authenticated |
| `GET`   | `/restaurant/:restaurantId`        | Get restaurant details by ID   | Authenticated |
| `POST`  | `/restaurant`                      | Register restaurant with owner | Admin         |
| `PATCH` | `/restaurant/:restaurantId`        | Update restaurant details      | Owner / Admin |
| `PATCH` | `/restaurant/:restaurantId/status` | Approve or suspend restaurant  | Admin         |

### Branches

| Method  | Endpoint                              | Description                        | Access        |
| ------- | ------------------------------------- | ---------------------------------- | ------------- |
| `GET`   | `/branches/near?lng=...&lat=...`      | Find nearby branches within radius | Public        |
| `GET`   | `/branches/:branchId`                 | Get branch details                 | Public        |
| `GET`   | `/branches/:branchId/restaurant`      | Get branch with restaurant context | Public        |
| `GET`   | `/restaurants/:restaurantId/branches` | List all branches for restaurant   | Authenticated |
| `POST`  | `/restaurants/:restaurantId/branches` | Create new branch                  | Owner / Admin |
| `PATCH` | `/branches/:branchId`                 | Update branch details              | Owner / Admin |
| `PATCH` | `/branches/:branchId/status`          | Update branch operational status   | Admin         |

### Products & Categories

| Method  | Endpoint                                | Description                         | Access        |
| ------- | --------------------------------------- | ----------------------------------- | ------------- |
| `GET`   | `/products/:productId`                  | Get product details                 | Public        |
| `GET`   | `/branches/:branchId/products`          | List branch menu with live pricing  | Public        |
| `GET`   | `/restaurants/:restaurantId/products`   | List restaurant catalog products    | Owner / Admin |
| `GET`   | `/restaurants/:restaurantId/categories` | List product categories             | Public        |
| `POST`  | `/restaurants/:restaurantId/products`   | Create product in restaurant        | Owner / Staff |
| `PATCH` | `/products/:productId`                  | Update product and branch overrides | Owner / Staff |

### Restaurant Members & RBAC

| Method   | Endpoint                                                | Description                      | Access        |
| -------- | ------------------------------------------------------- | -------------------------------- | ------------- |
| `GET`    | `/restaurants/:restaurantId/members`                    | List restaurant staff members    | Owner / Mgr   |
| `POST`   | `/restaurants/:restaurantId/members`                    | Invite new staff member          | Owner / Mgr   |
| `PATCH`  | `/restaurants/:restaurantId/members/:memberId`          | Update member role or status     | Owner / Mgr   |
| `PATCH`  | `/restaurants/:restaurantId/members/:memberId/branches` | Update member branch assignments | Owner         |
| `DELETE` | `/restaurants/:restaurantId/members/:memberId`          | Remove staff member              | Owner         |
| `GET`    | `/roles/:role/permissions`                              | Get permissions assigned to role | Authenticated |
| `GET`    | `/permissions`                                          | Query permissions by role name   | Authenticated |

### Orders

| Method  | Endpoint                     | Description                              | Access       |
| ------- | ---------------------------- | ---------------------------------------- | ------------ |
| `POST`  | `/orders`                    | Place new order (atomic stock hold)      | Customer     |
| `GET`   | `/orders/customer`           | List orders for current customer         | Customer     |
| `GET`   | `/orders/:publicId`          | Polymorphic single order view (UUID)     | Order Actors |
| `PATCH` | `/orders/:publicId/status`   | Advance status or cancel with reason     | Authorized   |
| `GET`   | `/branches/:branchId/orders` | List branch orders                       | Branch Staff |
| `POST`  | `/orders/agent/release`      | Release assigned orders if agent offline | Delivery     |

### Payments

| Method | Endpoint                                                                     | Description                       | Access        |
| ------ | ---------------------------------------------------------------------------- | --------------------------------- | ------------- |
| `POST` | `/payments/webhook/kashier`                                                  | Kashier payment gateway webhook   | Public        |
| `POST` | `/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment/init` | Initialize Kashier hosted session | Customer      |
| `GET`  | `/restaurants/:restaurantId/branches/:branchId/orders/:orderId/payment`      | Get payment details for order     | Customer/Mgr  |
| `POST` | `/orders/:orderId/payment/init`                                              | Direct order payment init         | Customer      |
| `GET`  | `/orders/:orderId/payment`                                                   | Direct order payment check        | Customer/Mgr  |
| `POST` | `/payments/:paymentId/refund`                                                | Request payment refund            | Admin / Owner |
| `GET`  | `/restaurants/:restaurantId/payments`                                        | List payments for restaurant      | Owner / Admin |

### Delivery Agents

| Method  | Endpoint                          | Description                     | Access |
| ------- | --------------------------------- | ------------------------------- | ------ |
| `POST`  | `/agents/presence/online`         | Set agent status to online      | Agent  |
| `POST`  | `/agents/presence/ping`           | Ping latest GPS coordinates     | Agent  |
| `POST`  | `/agents/presence/offline`        | Set agent status to offline     | Agent  |
| `POST`  | `/agents/orders/:publicId/accept` | Accept assigned delivery task   | Agent  |
| `POST`  | `/agents/orders/:publicId/reject` | Reject assigned delivery task   | Agent  |
| `PATCH` | `/agents/orders/:publicId/status` | Update delivery progress status | Agent  |
| `GET`   | `/agents/tasks`                   | Get current active agent tasks  | Agent  |
| `GET`   | `/agents/earnings`                | Get breakdown of agent earnings | Agent  |
| `GET`   | `/agents/earnings/sum`            | Get total earnings summary      | Agent  |
| `POST`  | `/admin/orders/:publicId/assign`  | Manually assign order to agent  | Admin  |

### Restaurant Finance

| Method | Endpoint                                   | Description                            | Access      |
| ------ | ------------------------------------------ | -------------------------------------- | ----------- |
| `GET`  | `/restaurants/:restaurantId/balance`       | Get current restaurant balance         | Owner / Mgr |
| `GET`  | `/restaurants/:restaurantId/payouts`       | List restaurant payout history         | Owner / Mgr |
| `POST` | `/admin/restaurants/:restaurantId/payouts` | Record payout settlement to restaurant | Admin       |

---

## Environment Variables

Copy the example configuration to `.env`:

```bash
cp .env.example .env
```

| Variable                      | Description                        | Example / Default                         |
| ----------------------------- | ---------------------------------- | ----------------------------------------- |
| `PORT`                        | HTTP server port                   | `3000`                                    |
| `NODE_ENV`                    | Application environment            | `development` / `production`              |
| `CORS_ORIGINS`                | Allowed CORS origin URLs           | `http://localhost:3000`                   |
| `DB_HOST`                     | PostgreSQL host                    | `localhost`                               |
| `DB_PORT`                     | PostgreSQL port                    | `5432`                                    |
| `DB_NAME`                     | PostgreSQL database name           | `core_service`                            |
| `DB_USERNAME`                 | PostgreSQL username                | `postgres`                                |
| `DB_PASSWORD`                 | PostgreSQL password                | `your_password`                           |
| `DB_POOL_MAX`                 | Max connection pool size           | `10`                                      |
| `REDIS_HOST`                  | Redis host                         | `localhost`                               |
| `REDIS_PORT`                  | Redis port                         | `6379`                                    |
| `REDIS_PASSWORD`              | Redis password (optional)          | `""`                                      |
| `ACCESS_SECRET`               | Secret key for JWT access tokens   | `your-access-secret`                      |
| `REFRESH_SECRET`              | Secret key for JWT refresh tokens  | `your-refresh-secret`                     |
| `ACCESS_EXPIRES_IN`           | Access token expiration            | `1h`                                      |
| `REFRESH_EXPIRES_IN`          | Refresh token expiration           | `7d`                                      |
| `MJ_API_KEY`                  | Mailjet API Public Key             | `your_mailjet_api_key`                    |
| `MJ_SECRET_KEY`               | Mailjet API Secret Key             | `your_mailjet_secret_key`                 |
| `FROM_EMAIL`                  | Sender email for notifications     | `no-reply@quickbite.com`                  |
| `FROM_NAME`                   | Sender display name                | `QuickBite`                               |
| `KASHIER_BASE_URL`            | Kashier API gateway URL            | `https://test-api.kashier.io`             |
| `KASHIER_MERCHANT_ID`         | Kashier Merchant ID                | `MID-XXXX-XXXX`                           |
| `KASHIER_API_KEY`             | Kashier Public API Key             | `pk_test_xxx`                             |
| `KASHIER_SECRET_KEY`          | Kashier Secret API Key             | `sk_test_xxx`                             |
| `KASHIER_WEBHOOK_SECRET`      | Kashier Webhook HMAC Secret        | `whsec_xxx`                               |
| `KASHIER_RETURN_URL`          | Checkout redirect URL on success   | `https://app.example.com/checkout/return` |
| `KASHIER_FAIL_URL`            | Checkout redirect URL on failure   | `https://app.example.com/checkout/failed` |
| `PAYMENT_SESSION_TIMEOUT_MIN` | Hosted checkout timeout in minutes | `15`                                      |

All environment variables are validated at startup using Zod in `src/lib/config/env.ts`.

---

## Getting Started

### 1. Prerequisites

- **Node.js** (v20 or higher)
- **PostgreSQL** (v15+ with PostGIS extension enabled)
- **Redis** (v7+)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local PostgreSQL and Redis credentials
```

### 4. Run Database Migrations

```bash
npm run migrate:latest
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start at: `http://localhost:3000`

### 6. Verify Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "message": "Service is healthy",
  "data": {
    "status": "UP",
    "db": "CONNECTED",
    "timestamp": "2026-10-17T01:00:00.000Z"
  }
}
```

---

## Useful Commands

```bash
# Development
npm run dev             # Start dev server with file watching via tsx
npm run build           # Compile TypeScript to dist/
npm run start           # Run compiled production server

# Quality & Type Checking
npm run typecheck       # Run TypeScript compiler check without emitting files
npm run format          # Format codebase using Prettier
npm run format:check    # Check codebase formatting

# Database Migrations
npm run migrate:make -- name_of_migration   # Create a new Knex migration file
npm run migrate:latest                     # Run all pending migrations
npm run migrate:rollback                   # Rollback the last migration batch

# Performance & Benchmarks
npm run benchmark       # Run automated Autocannon latency and capacity benchmarks
```

---

## Design Decisions

- **Consistent Layering**: `Controller → Service → Repository → Database`.
  - Controllers only deal with HTTP parsing and responses.
  - Services orchestrate business logic and transactions.
  - Repositories isolate Knex SQL queries.
- **Explicit Column Projection**: Every repository defines a static `COLUMNS` list to avoid `SELECT *` and guarantee predictable memory consumption and performance.
- **Standardized `{ message, data }` Response Format**: All controllers return consistent JSON structures formatted through Response DTOs.
- **Naming Conventions**:
  - Database tables and columns use `snake_case`.
  - TypeScript entities and DTO properties use `camelCase`.
  - Repositories map between the two formats cleanly.
- **Atomic Operations**: Critical workflows (such as order checkout with stock deduction, registration with owner creation, and payout recording) run inside Knex database transactions.
- **Loose Coupling via Interfaces**: Infrastructure concerns (Redis cache, Mailjet email, Kashier gateway) are abstracted behind interfaces and injected via `tsyringe`.
