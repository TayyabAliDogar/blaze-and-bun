# Blaze & Bun — Technical & Architecture Overview

**A client-ready technical reference sheet for the Blaze & Bun ordering platform.**
This document describes the production architecture, backend integrations, and answers the questions a stakeholder or technical auditor is most likely to ask.

---

## 1. Tech Stack & Languages Used

| Layer | Technology | Purpose / Notes |
|------|-----------|-----------------|
| **Language** | TypeScript (strict) | End-to-end type safety across client, server, API, and database access layer |
| **Frontend framework** | Next.js 16 (App Router, React 19) | Server Components, Route Handlers, client components; static + dynamic rendering |
| **UI/styling** | Tailwind CSS 4, Framer Motion, lucide-react | Responsive dark-theme storefront, motion/animation, icons |
| **Data fetching / state** | Zustand (client state), Server Actions / API routes | Client cart + auth stores; server-authoritative pricing |
| **ORM / DB access** | Prisma ORM 7 (Prisma Client + PrismaPg adapter) | Typed queries, migrations, transactions |
| **Database** | PostgreSQL (Supabase) | Relational data model; multi-currency + soft-delete isolation |
| **Auth / sessions** | jose (JWT), bcryptjs, custom session registry | HMAC-SHA256 signed JWTs, DB-backed refresh-token rotation |
| **Validation** | Zod | Server-side env & input validation |
| **Payments** | Stub Stripe gateway + idempotent webhook ledger | Real backend-ready webhook contract; swap-in live Stripe |
| **Geolocation** | Mapbox GL + geocoder, custom Haversine engine | Address lookup, distance/radius calculations |
| **Email (transactional)** | Resend (SDK installed) | Confirmations / reset flows |
| **Deployment targets** | Vercel (edge + Node runtimes) · Supabase (Postgres hosting) | CI-friendly, serverless-ready |
| **Tooling** | ESLint, TypeScript 5, tsx (scripts/seed), `prisma` CLI | Lint, typecheck, migrate, seed |

**Key versions:** Next.js 16.3 · React 19.2 · Prisma 7.10 · Tailwind 4 · TypeScript 5.

---

## 2. Complete Backend Architecture & Integrations

### 2.1 Database Schema (PostgreSQL via Prisma)

A normalized relational model organized into focused domains:

- **Identity & access** — `User`, `Session` (refresh-token rotation/revocation), roles `customer` / `staff` / `admin`.
- **Branch & location** — `Branch` (geo coordinates, timezone, opening-hour schedule, delivery radius, currency, default/featured flags).
- **Menu** — `MenuCategory`, `MenuItem`, and **per-branch** `MenuItemPrice` (row per item × branch for currency/price isolation).
- **Orders** — `Order` (guest + authenticated, delivery/pickup, payment status, ETA, notes, currency), `OrderItem` with a JSON **customization snapshot**, and `OrderStatusLog` (immutable lifecycle audit trail).
- **Promotions** — `PromoCode`, `PromoRedemption` (one redemption per order, per-user/email usage caps).
- **Payments** — `PaymentEvent` (idempotency ledger for inbound webhooks).
- **Compliance** — `AdminAuditLog` for immutable admin/staff action trails; `Review` (internal + Google sources) with moderated approval.

Every table carries soft-delete / `isActive` flags and per-branch currency isolation, plus targeted indexes for the hot query paths (`branchId+status`, `createdAt`, `guestEmail`, etc.).

### 2.2 Multi-Branch Engine

- Each branch defines its own **coordinates, timezone, opening schedule, delivery radius, currency, and per-branch menu prices**.
- `resolveBranch(req)` resolves the active branch from a signed, HttpOnly branch cookie, falling back to the default branch.
- Availability is computed in the branch's own timezone from the schedule (`getBranchStatus` → open/closed, next transition) — so a branch open in London is handled independently of one in NYC.
- `nearestBranch()` ranks active branches by Haversine distance for delivery. Branch selection persists across the session via a strict Secure cookie.

### 2.3 Geolocation

- Mapbox GL front-end for interactive address selection & geocoding.
- Server-side **Haversine engine** (`src/lib/geo.ts`) computes great-circle distance — dependency-free, safe to run in client, Edge, and Node.
- Distance drives `withinRadiusKm` checks and the **delivery ETA** (distance from branch → delivery minutes), and the storefront highlights branches within delivery range.

### 2.4 Server-Side Price Engine (anti-tampering)

- The client never sets prices. A cart is submitted as `{ itemId, quantity, customizations }` only.
- On the server, `buildServerCart` re-resolves every line against the **per-branch price map** (`MenuItemPrice`) + the **customization catalog**, recomputes customization deltas, and derives authoritative subtotal / delivery fee / tax / total via `computeTotalsCore`.
- Promotions are re-validated server-side (active, date-window, branch scope, usage caps) and applied as a **cap** on the server total.
- All money math is fixed-point safe (`round2`, epsilon handling) and clamped to DB column limits.

### 2.5 Customization Snapshotting

- Each order line stores an immutable JSON **customization snapshot** capturing size, bun, heat/spice, add-ons, notes, and **special instructions** (dietary / allergy notes).
- The server re-derives the snapshot from the catalog when the order is placed, so staff (Admin Kitchen Panel) see exactly what the customer configures — including alerts flagged for dietary/allergy instructions — even if the menu later changes.

### 2.6 Atomic Order Transactions

- Checkout runs inside a **single Prisma transaction (`$transaction`)**:
  creates the order → creates order items with snapshots → increments promo usage → creates the initial `OrderStatusLog` → returns the order id.
- Nothing is persisted partially; a failure on any step rolls the entire order back.
- A **guest order access token** (SHA-256 hash stored, raw token returned once) enables secure guest order lookup and the 120-second self-service cancellation window.
- The stub payment **intent is only minted after** the order row exists, then confirmed via the webhook ledger.

### 2.7 Admin State Machine & Operations

- `src/lib/admin/orderStateMachine.ts` defines the legal order transitions over the DB enum: `pending → received → preparing → ready → completed`, with explicit forward/backward rules and a guarded `cancelled` path.
- Every legal move writes an `OrderStatusLog` (source: staff/admin/payment/customer) **and** an `AdminAuditLog` (actor, action, IP) inside a transaction — a complete, immutable audit trail.
- A drill/kanban **Order Management panel** and **Analytics dashboard** (revenue, today's orders, status breakdown, top items per branch) run on admin-only API routes.
- **Dynamic ETA & kitchen-load engine**: ETA = base prep (15 min) + distance-based delivery estimate, plus a **+10 min surge penalty** when more than 10 orders are actively `PREPARING` at a branch.

### 2.8 Webhook & Payment Ledger

- `POST /api/payments/webhook` implements an **idempotent** ledger: every inbound event is keyed by `eventId` (unique), so retries are ack'd without re-processing.
- On `payment_intent.succeeded` / captured, the order's `paymentStatus` moves to `paid` and a status log is recorded — all in a transaction.

---

## 3. Client FAQ / Technical Q&A Preparation

### Q1. How does the platform handle multi-branch pricing and store availability?

Each store branch is a first-class row with its **own coordinates, timezone, opening-hours schedule, delivery radius, and currency**. Menu prices live in a dedicated `MenuItemPrice` table row for every (item × branch) pair, giving full price isolation per location. When a customer submits a cart, the server rebuilds the price from that branch's own price map — never from the client. Store availability is computed in the **branch's own timezone** from its schedule, so a branch in London and one in New York each open/close independently, and customers are automatically routed to the default or nearest active branch within delivery range.

### Q2. How do you ensure data integrity during checkout and prevent price tampering?

Prices are never trusted from the browser. A client only sends **which** items and **how** they're customized; the server re-prices every line against the per-branch price table and the customization catalog, then recomputes delivery fee, tax, and discounts itself. The whole checkout is wrapped in a **single database transaction** so the order, its items, the status log, and any promo redemption either all commit or all roll back. Promotions are re-validated server-side (active dates, branch scope, usage caps) and applied as a capped discount. Money is handled with fixed-point-safe math, and the client is fed back the authoritative server totals for display.

### Q3. What security measures protect user authentication, sessions, and admin routes?

- **Passwords:** bcrypt (cost factor 10); the raw password is never stored or logged.
- **Sessions:** a dual-token JWT model. A short-lived access token (15 min) plus a refresh token whose **hash is stored in a Session row**; refresh uses **rotation** (each use revokes the old session and issues a new one) with revocation on logout.
- **Cookies:** access/refresh/branch/guest cookies are **HttpOnly**, `SameSite=Strict`, and `Secure` in production.
- **Rate limiting** on credential endpoints (sliding window per IP) and **login failure tracking**.
- **Admin routes:** every `/api/admin/*` route enforces a re-verified JWT **and** a live, active user row with an `admin`/`staff` role check (defense in depth), and every admin action is written to an immutable `AdminAuditLog`.
- **Guest order access:** only a one-way SHA-256 hash of a one-time token is stored, compared in constant time — raw tokens are never persisted.
- Validation is centralized with **Zod**; environment secrets are fail-fast validated and never exposed to the client.

### Q4. How does the system handle real-time kitchen operations and order status transitions?

Order statuses flow through a **server-enforced state machine** (`pending → received → preparing → ready → completed`, plus a guarded `cancelled`). Only legal transitions are accepted, and each successful move writes an immutable `OrderStatusLog` (who/what/from/to) plus an `AdminAuditLog` in a single transaction. The admin Order Management view is a live dashboard that **polls every 8 seconds**, showing a kanban/drill board of every branch's current orders so staff can move tickets forward or correct errors. The same transitions drive the customer-facing live status timeline, with a countdown ETA that reacts to BOTH delivery distance and current kitchen load (a +10-minute surge when more than 10 orders are in `preparing`).

### Q5. Is the backend scalable for production deployment on platforms like Vercel and Supabase?

Yes. The stack is built for serverless + managed Postgres:

- **Next.js (Vercel):** route handlers declare the correct runtime per endpoint (`nodejs` for the API, edge-ready helpers elsewhere) and are set to dynamic/force-dynamic where live data is required, avoiding stale caches.
- **Supabase (Postgres):** a normalized schema with targeted indexes on the hot query paths, transactions for correctness, and connection pooling configured through the driver — so it scales under concurrent checkout load.
- **Auth:** JWT access tokens are stateless; refresh tokens are DB-backed with rotation, which is multi-instance safe. The only single-instance piece is the **in-memory rate limiter**, which is deliberately isolated and designed to be swapped for Redis at production scale — no other subsystem depends on local process state.
- **Idempotent webhooks** make payment confirmation retry-safe across instances.
- Standard CI (`tsc --noEmit`, ESLint, Prisma migrations) keeps the repository deploy-ready.

---

*Prepared from the Blaze & Bun codebase — architecture reflects the currently implemented Phase 6 / Phase 6.5 systems (multi-branch pricing & availability, server-side price engine, customization snapshots, atomic transactions, admin state machine + audit, idempotent payment webhooks, guest order access, and dynamic ETA/kitchen-load).*
