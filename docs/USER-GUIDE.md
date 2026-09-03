# Blaze & Bun — Documentation & User Guide

---

## Table of Contents

1. [Payment Gateway Architecture & Methods](#1-payment-gateway-architecture--methods)
2. [Admin Menu & Branch Management Guide](#2-admin-menu--branch-management-guide)

---

## 1. Payment Gateway Architecture & Methods

### 1.1 Overview

Blaze & Bun supports four payment methods at checkout:

| Method | Code | How it works |
|--------|------|-------------|
| Credit / Debit Card | `card` | Customer enters card details; payment is confirmed immediately at checkout |
| Google Pay | `googlepay` | One-tap wallet payment; same confirmation flow as card |
| Apple Pay | `applepay` | One-tap wallet payment; same confirmation flow as card |
| Cash on Delivery | `cod` | Customer pays cash when the order arrives |

Card details (number, expiry, CVV) are validated **entirely on the customer's device**. No card data is ever sent to or stored on the Blaze & Bun server.

### 1.2 How a Card / Wallet Payment Works

```
Customer clicks "Pay & Place Order"
        │
        ▼
┌─────────────────────────────────────────┐
│  1. Client validates card locally       │
│     (Luhn check, expiry, CVV format)    │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  2. POST /api/orders/checkout           │
│     Server creates the order in the DB  │
│     Status: received                    │
│     Payment status: unpaid              │
│     Returns a payment reference ID      │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  3. Client calls POST                   │
│     /api/payments/webhook               │
│     Event type: payment_intent.succeeded│
│     (Simulates successful bank charge)  │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  4. Server flips payment status         │
│     unpaid  →  paid                     │
│     An audit record is written          │
└─────────────────────────────────────────┘
```

The customer sees instant confirmation: "Order Placed!" with a live order tracker.

### 1.3 How Cash on Delivery Works

```
Customer selects "Cash on Delivery"
        │
        ▼
┌─────────────────────────────────────────┐
│  1. POST /api/orders/checkout           │
│     Server creates the order            │
│     Status: received                    │
│     Payment status: unpaid              │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  2. The payment webhook is NOT called.  │
│     Payment status stays "unpaid".      │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  3. Customer pays cash to the rider.    │
│     Staff marks the order as completed  │
│     from the Admin Panel.              │
└─────────────────────────────────────────┘
```

> **Note:** There is no separate "Card on Delivery" method. All card-based payments are processed online at the time of order placement.

### 1.4 The Payment Webhook — Atomic Status Update

**Endpoint:** `POST /api/payments/webhook`

This is the mechanism that flips an order from **Unpaid → Paid**. It is designed to be safe to call multiple times (idempotent).

#### Request Body

```json
{
  "eventId": "evt_1725312345_abc123",
  "type": "payment_intent.succeeded",
  "orderId": "clx9abc123...",
  "paymentIntentId": "pi_stub_..."
}
```

| Field | Required | Purpose |
|-------|----------|---------|
| `eventId` | Yes | Unique identifier for this webhook event. Prevents the same event from being processed twice. |
| `type` | Yes | Must contain `"succeeded"` or `"captured"` to count as a successful payment. |
| `orderId` | One of orderId or paymentIntentId required | Directly identifies the order. |
| `paymentIntentId` | Fallback | If `orderId` is not provided, the system looks up the order by its payment reference. |

#### What Happens (Step by Step)

1. **Duplicate check** — The system looks up `eventId` in the PaymentEvent ledger. If it already exists, the webhook is silently acknowledged (no double-processing).
2. **Order lookup** — The system finds the matching order by `orderId` or `paymentIntentId`.
3. **Status flip** — Inside a single database transaction:
   - The order's `paymentStatus` changes from `unpaid` to `paid`.
   - An audit record is written to the `PaymentEvent` table (with the full webhook payload).
   - An `OrderStatusLog` entry is created with source `payment` and note "Payment captured".
4. **Response** — Returns `{ ok: true }`.

#### Why It Is Safe

- **Idempotent:** Calling the same webhook twice does nothing the second time (the `eventId` is unique).
- **Atomic:** The status flip and audit write happen in one database transaction — either both succeed or both roll back.
- **No order status change:** The webhook only changes `paymentStatus`, not `Order.status`. These are tracked independently.

### 1.5 Payment Status Lifecycle

```
unpaid ──(webhook: payment_intent.succeeded)──▶ paid
   │
   └──(customer cancels, was never paid)──▶ stays unpaid

paid ──(customer cancels)──▶ refunded
```

| Status | Meaning |
|--------|---------|
| `unpaid` | Order placed but payment not yet confirmed (COD orders stay here permanently) |
| `paid` | Payment successfully captured |
| `refunded` | Order was cancelled after payment was already captured |
| `failed` | Defined in the system but not currently triggered automatically |

### 1.6 Order Status Lifecycle

Orders move through six statuses. Each transition is logged with a timestamp and who made the change.

```
pending ──▶ received ──▶ preparing ──▶ ready ──▶ completed
   │            │            │            │
   └────────────┴────────────┴────────────┘
                    cancelled
```

| Status | Admin Panel Label | What It Means |
|--------|-------------------|---------------|
| `pending` | Received | New order, just placed |
| `received` | In Kitchen | Accepted by staff, kitchen notified |
| `preparing` | Preparing | Being cooked / assembled |
| `ready` | Ready | Ready for pickup or out for delivery |
| `completed` | Delivered | Handed to customer |
| `cancelled` | Cancelled | Cancelled by customer or staff |

**Cancellation rules:**
- Customers can cancel within **2 minutes** of placing an order.
- Only orders in `pending` or `received` status can be cancelled by customers.
- If the order was already paid, cancellation triggers an automatic refund status.

### 1.7 Summary — What the Store Owner Needs to Know

| Scenario | What Happens |
|----------|-------------|
| Customer pays by card / Google Pay / Apple Pay | Payment is confirmed instantly. Order shows as "paid" in the admin panel. |
| Customer pays Cash on Delivery | Order shows as "unpaid". Rider collects cash. Staff marks as completed. |
| Webhook fails or is called twice | The system is safe — duplicate calls are ignored, and the audit trail tracks every event. |
| Customer cancels a paid order | Payment status automatically changes to "refunded". |
| Customer cancels a COD order | Order is cancelled. No money was collected, so no refund is needed. |

---

## 2. Admin Menu & Branch Management Guide

### 2.1 Logging In to the Admin Panel

1. **Open your browser** and go to your Blaze & Bun website URL (e.g. `https://your-store.com`).
2. **Click "Sign In"** (or open the login modal from the navigation bar).
3. **Enter your admin credentials:**
   - Email: `admin@blazeandbun.com`
   - Password: `BlazeAdmin2026!`
4. **Click "Log In".** You will see a green checkmark confirming you are signed in.
5. **Navigate to the Admin Panel** by going to:
   ```
   https://your-store.com/admin
   ```
   You will see the Admin Dashboard with three tabs at the top:
   - **Dashboard** — Revenue overview and top-selling items
   - **Orders** — Live order management (Kanban board)
   - **Branches** — Branch status and emergency controls

> **Important:** Only users with the `admin` or `staff` role can access the admin panel. New accounts created through the website are always `customer` role. Admin and staff accounts must be created directly in the database by a developer.

### 2.2 The Admin Dashboard

When you first log in to `/admin`, you see the **Dashboard** tab which shows:

- **Total revenue** for today, this week, and this month
- **Order count** breakdown by status
- **Top-selling items** ranked by quantity sold, broken down by branch

This page is read-only — it updates automatically as new orders come in (polls every 8 seconds).

### 2.3 Managing Orders

Click the **Orders** tab in the admin navigation bar.

You will see a **Kanban board** — a visual board with columns for each order stage:

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Received │  │Preparing │  │  Ready   │  │ Delivered│
│          │  │          │  │          │  │          │
│ [card]   │  │ [card]   │  │ [card]   │  │ [card]   │
│ [card]   │  │ [card]   │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**To advance an order to the next stage:**

1. **Click on an order card** to open the order detail panel on the right.
2. You will see the customer's name, delivery address, items ordered, and the current status.
3. **Click the button for the next status** (e.g. "Move to Preparing" or "Mark as Ready").
4. The order card moves to the next column on the board.

**Status flow:**

```
Received → Preparing → Ready → Delivered
```

Any status can also be moved to **Cancelled** if needed (e.g. if an item is out of stock).

**Order board refreshes automatically** every 8 seconds, so new orders appear without manual refresh.

### 2.4 Managing Branches — Emergency Store Pause

Click the **Branches** tab in the admin navigation bar.

You will see a card for each store location showing:

- **Branch name and city**
- **Status badge:** green "Open" or red "Paused"
- **Revenue and order count** for the current period

#### Pausing a Branch (Emergency Closure)

Use this when a store needs to stop accepting orders temporarily (e.g. equipment failure, staffing issue, weather emergency).

1. **Find the branch card** you want to pause.
2. **Click "Pause branch".**
3. The badge changes from green "Open" to red "Paused".
4. **Customers can no longer order from this branch.** If a customer had this branch selected, they are automatically redirected to the default branch.

#### Reopening a Branch

1. **Find the paused branch card.**
2. **Click "Reopen branch".**
3. The badge changes back to green "Open".
4. **Orders resume immediately** — the branch is visible to customers again.

> **What happens behind the scenes:** Pausing a branch sets a flag in the database (`Branch.isActive = false`). The customer-facing menu API checks this flag on every request and hides all items for paused branches. This change takes effect **instantly** — no cache to clear, no restart needed.

### 2.5 Menu Items — Current Capabilities

The Blaze & Bun system is built with a full menu database that supports:

| Feature | Supported | How to Use |
|---------|-----------|------------|
| Per-branch pricing | Yes | Each branch can have different prices for the same item |
| Item availability toggle | Yes | Mark items as out of stock (`isActive = false`) |
| Soft delete | Yes | Hide items without permanently deleting them (`isDeleted = true`) |
| Category management | Yes | Add, reorder, or hide entire menu categories |

**Currently, menu item editing is done through the database directly** (via Prisma Studio or direct database queries). The admin panel UI for menu editing is not yet built.

**How to edit menu items today** (for a developer or technically-assisted setup):

1. **View menu items:** Run `npx prisma studio` from the project folder to open a visual database editor in your browser.
2. **Navigate to the `MenuItem` table** to see all items.
3. **Edit any field:**
   - `name` — The item name shown to customers
   - `description` — The description text
   - `imageUrl` — The photo URL
   - `isActive` — Toggle to `false` to mark as out of stock
   - `isDeleted` — Toggle to `true` to hide the item completely
4. **Edit per-branch prices:** Navigate to the `MenuItemPrice` table. Each row links one item to one branch with a price. Change the `price` column to update what customers see.
5. **Save changes.** They appear on the customer menu **immediately**.

### 2.6 How Admin Changes Sync to the Customer Menu

This is one of the strongest features of the architecture:

> **Every change you make in the admin panel (or database) is visible to customers instantly. There is no cache to clear, no rebuild to run, no restart required.**

#### Why It Works This Way

The customer-facing menu API (`GET /api/menu`) is configured as **always fresh** — it queries the database on every single request. This means:

| What You Change | Where | Customer Sees It |
|-----------------|-------|------------------|
| Pause a branch | Admin → Branches tab | Instantly — branch items disappear |
| Reopen a branch | Admin → Branches tab | Instantly — branch items reappear |
| Mark item as out of stock | Database `MenuItem.isActive = false` | Instantly — item hidden from menu |
| Change an item's price | Database `MenuItemPrice.price` | Instantly — new price shown |
| Hide a category | Database `MenuCategory.isDeleted = true` | Instantly — entire category hidden |
| Add a new item | Database `MenuItem` + `MenuItemPrice` rows | Instantly — appears on menu |

#### The Sync Flow

```
Admin makes a change (pause branch, edit price, etc.)
        │
        ▼
Change is written to the database
        │
        ▼
Customer opens the app (or refreshes)
        │
        ▼
GET /api/menu queries the database
        │
        ▼
Fresh data returned — change is live
```

There is **no intermediate cache layer**. The database is the single source of truth, and every customer request reads directly from it.

### 2.7 Quick Reference — Admin Panel Navigation

| URL | What You See |
|-----|-------------|
| `/admin` | Dashboard — revenue stats, top sellers |
| `/admin/orders` | Order Kanban board — manage live orders |
| `/admin/branches` | Branch controls — pause / reopen stores |
| `/` (main site) | Customer-facing menu — changes appear instantly |

### 2.8 Frequently Asked Questions

**Q: Can I create new admin accounts from the admin panel?**
A: Not yet. Admin and staff accounts must be created directly in the database. Customer accounts can be created through the website signup form.

**Q: What if I pause the wrong branch by accident?**
A: Simply click "Reopen branch" on the same card. The change is instant.

**Q: How do I mark an item as sold out?**
A: A developer or DB admin sets `isActive = false` on the item in the `MenuItem` table. The item disappears from the menu immediately. Set it back to `true` when it is available again.

**Q: Can different branches have different prices for the same burger?**
A: Yes. The `MenuItemPrice` table stores one price per item per branch. Each branch can have its own pricing.

**Q: What happens if a customer's branch gets paused while they are ordering?**
A: The system automatically falls back to the default branch. The customer sees a notification about the change.

**Q: Does the order board update in real time?**
A: The board polls the server every 8 seconds. New orders and status changes appear automatically without manual refresh.

---

*Last updated: September 2026*
