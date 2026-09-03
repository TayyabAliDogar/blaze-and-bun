# 🔥 Blaze & Bun

A production-ready, full-stack burger ordering web app — **Next.js 16** at the core, backed by **Supabase + Prisma**, with **Stripe** payments, **Google OAuth**, real-time branch availability, and a full admin dashboard.

> **Status:** Production-ready codebase. Google Auth, stripe checkout, order tracking, and admin tooling are all wired up.

---

## ✨ Features

**Customer experience**
- 🍔 **Interactive menu & meal builder** — drill into any item, pick sizes and options, and send it straight to the cart
- 🗂 **Smart cart & checkout** — guest + signed-in ordering with a full Stripe card checkout flow
- 📍 **Location-aware ordering** — pick a branch, see real-time availability, and route the order to the nearest location
- 🧾 **Order tracking** — confirmations, status history, guest order access via secure order links, and cancellations
- ⭐ **Reviews** — leave and read reviews on completed orders
- 🔐 **Authentication** — email/password **plus one-click Google OAuth** `Continue with Google`
- 💳 **Stripe payments** — test-mode card processing with webhook-backed event handling
- 📱 **App-style landing** — polished marketing sections, store badges, and design-system UI

**Admin dashboard**
- 📊 **Analytics** dashboard
- 🍔 **Menu management** — items, categories, prices, per-branch out-of-stock toggling
- 🏪 **Branch management**
- 📦 **Order management** with a state machine
- 🏷 **Promo codes & redemption tracking**
- 👥 **User management**
- ⭐ **Review moderation** — plus a full admin audit log

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16.3](https://nextjs.org) (App Router, Webpack) + React 19 |
| **Language** | TypeScript 5 |
| **Database / ORM** | Supabase (Postgres) + [Prisma 7](https://www.prisma.io) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) + Framer Motion |
| **Auth** | JWT sessions (jose / jsonwebtoken), Google OAuth 2.0, password hashing (bcryptjs) |
| **Payments** | [Stripe](https://stripe.com) (Stripe.js, React Stripe.js, webhooks) |
| **Email** | Resend (password reset / verification) |
| **Caching / rate-limiting** | Redis (ioredis) with an in-memory fallback |
| **Validation** | Zod |
| **State** | Zustand |
| **Maps / geolocation** | Mapbox GL + Geocoding |
| **Linting** | ESLint (Next.js config) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** and npm
- A **Supabase** project (Postgres database)
- Optional integrations (safe to defer): **Stripe**, **Google OAuth**, **Resend**, **Mapbox**, **Redis**

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the template and fill in your real values:

```bash
cp .env.example .env.local
```

Open `.env.local` and set the required values:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | Postgres pooler URL (Prisma runtime) |
| `DIRECT_URL` | ✅ | Postgres direct URL (`prisma migrate dev`) |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server-only) |
| `SESSION_SECRET` / `REFRESH_SECRET` | ✅ | JWT signing secrets (≥ 32 chars, random) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `http://localhost:3000` for local dev |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⭕ | Enables "Continue with Google" |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⭕ | Enables card checkout |
| `RESEND_API_KEY` | ⭕ | Transactional email |
| `MAPBOX_ACCESS_TOKEN` | ⭕ | Maps & geocoding |
| `REDIS_URL` | ⭕ | Caching (falls back to in-memory) |

> 🔒 **Security:** Never commit real secrets. `.env.local` is gitignored; `.env.example` ships with placeholders only.

### 3. Set up the database

```bash
npm run prisma:generate   # Generate the Prisma client
npm run prisma:migrate    # Apply migrations (uses DIRECT_URL)
npm run prisma:seed       # Seed demo menu, branches, and admin account
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On startup, a built-in **env check** prints which integrations are configured and walks you through enabling the ones you skipped.

---

## ⚙️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server (Webpack) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Apply DB migrations |
| `npm run prisma:seed` | Seed demo data & admin account |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |

---

## 🔐 Authentication & OAuth

- **Email/password** auth with hashed passwords and signed JWT session cookies.
- **Google OAuth** — a hand-rolled OAuth 2.0 flow. To enable:
  1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
  2. Add `http://localhost:3000/api/auth/google/callback` as an **authorised redirect URI**.
  3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.
  4. Restart `npm run dev` — the env check confirms Google is live.

If Google keys are absent, the button degrades gracefully instead of dead-ending.

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── (marketing) pages      # home, menu, checkout, orders, account, etc.
│   ├── admin/                 # admin dashboard (orders, menu, branches, promos…)
│   ├── api/                   # Next.js route handlers (auth, orders, payments…)
│   └── login,
│       reset-password/…       # auth pages
├── components/                # UI, sections, checkout, auth modal, navbar…
├── data/                      # static demo data (menu, branches, reviews)
├── lib/                       # auth, prisma, stripe, cache, geo, location, orders…
├── store/                     # Zustand stores (auth, toast)
├── generated/prisma/          # generated Prisma client
└── proxy.ts                   # dev proxy server
prisma/
├── schema.prisma
├── migrations/                # versioned migrations
└── seed.ts                    # seed script
scripts/check-env.mjs          # startup env check (runs via predev)
```

---

## 🛠 Production Deployment

1. **Build & start** — `npm run build` then `npm run start`, or deploy to Vercel/any Node host.
2. **Database** — point `DATABASE_URL`/`DIRECT_URL` at your Supabase project and run migrations.
3. **Real secrets** — set all env vars in your hosting provider (never in the repo).
4. **Redis** — add a Redis URL if you need multi-instance caching/rate limiting.
5. **Integrations** — enable Stripe (switch to live keys), Google OAuth (register the production redirect URI), and Resend.

---

## 📜 License

Private project. All rights reserved.
