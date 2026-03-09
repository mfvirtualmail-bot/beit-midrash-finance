# CLAUDE.md — Beit Midrash Finance

This file is auto-read by Claude Code at the start of every session.
It contains project context, architecture notes, and a running log of all development sessions.

---

## Project Overview

**Name:** ניהול כספים - בית המדרש (Beit Midrash Finance)
**Purpose:** Financial management web app for a Jewish study institution (Beit Midrash).
**Deployed on:** Vercel — https://vercel.com/mfvirtualmail-5505s-projects/beit-midrash-finance
**Database:** Supabase (PostgreSQL)
**Repo:** mfvirtualmail-bot/beit-midrash-finance

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18, Tailwind CSS v4, Lucide icons, Recharts |
| Database | Supabase (PostgreSQL via `@supabase/supabase-js`) |
| Auth | Custom cookie-based sessions; PBKDF2/SHA-512 password hashing |
| Hebrew calendar | `@hebcal/core` |
| Export | `xlsx` for Excel/CSV export |

---

## Architecture

### Auth
- Custom session tokens stored in Supabase `sessions` table
- Cookie name defined in `lib/constants.ts`
- `middleware.ts` protects all routes except `/login` and `/api/auth/*`
- Password hashing: PBKDF2 with SHA-512, 10k iterations (`lib/auth.ts`)
- Default users seeded: `admin/admin123`, `user1/1234`, `user2/1234`

### Database (Supabase)
- Schema defined in `supabase-schema.sql`
- Client in `lib/supabase.ts` — uses service role key server-side
- Seeding: default categories + users auto-created on first run (`ensureSeeded()`)

### Bilingual Support
- Languages: Hebrew (`he`) + English (`en`) with full RTL support
- `lib/i18n.ts` — all UI strings
- `lib/LangContext.tsx` — React context for lang switching
- Language toggle in header (persisted in localStorage)

### Hebrew Calendar
- `lib/hebrewDate.ts` — utilities using `@hebcal/core`
- Converts Gregorian ↔ Hebrew dates
- Gets Shabbat parasha / Yom Tov labels for weekly purchases
- Used in invoices (Hebrew period labels) and weekly purchases

---

## App Modules / Pages

| Route | Description |
|---|---|
| `/` | Dashboard — YTD income/expense/balance + recent transactions |
| `/transactions` | All transactions (income/expense/purchase) with filter, add, edit, delete, export |
| `/purchases` | Weekly purchases — grouped by week with Shabbat/parasha label, linked to members |
| `/recurring` | Recurring transactions — define templates, auto-generate to transactions |
| `/members` | Member list — charges, payments, balance per member |
| `/members/[id]` | Member detail — individual charge/payment history |
| `/members/import` | Bulk CSV import of members |
| `/donors` | Donor list |
| `/donors/[id]` | Donor detail — individual donation history |
| `/invoices` | Invoice list — create, view, mark status |
| `/invoices/[id]` | Invoice detail with line items |
| `/categories` | Category management (income/expense/purchase types, colors, bilingual names) |
| `/reports` | Financial reports with charts (by month, category) |
| `/settings` | App settings (organization name, currency, invoice defaults) |
| `/profile` | User profile — change display name and password |
| `/login` | Login page |

---

## API Routes

```
/api/auth/login         POST  — login, create session
/api/auth/logout        POST  — destroy session
/api/auth/me            GET   — current user info
/api/auth/profile       PUT   — update display name / password
/api/auth/password      PUT   — change password

/api/transactions       GET, POST
/api/transactions/[id]  GET, PUT, DELETE

/api/categories         GET, POST
/api/categories/[id]    GET, PUT, DELETE

/api/members            GET, POST
/api/members/[id]       GET, PUT, DELETE
/api/members/[id]/charges         GET, POST
/api/members/[id]/charges/[cid]   PUT, DELETE
/api/members/[id]/payments        GET, POST
/api/members/[id]/payments/[pid]  PUT, DELETE
/api/members/monthly-fee          POST — bulk charge monthly fee to all active members
/api/members/import               POST — CSV import

/api/donors             GET, POST
/api/donors/[id]        GET, PUT, DELETE
/api/donors/[id]/donations         GET, POST
/api/donors/[id]/donations/[did]   PUT, DELETE

/api/invoices           GET, POST
/api/invoices/[id]      GET, PUT, DELETE
/api/invoices/generate  POST — auto-generate invoices from member charges + purchases for a date range

/api/recurring          GET, POST
/api/recurring/[id]     GET, PUT, DELETE
/api/recurring/generate POST — generate transactions from recurring templates

/api/reports            GET — summary + monthly breakdown
/api/export             GET — Excel/CSV export

/api/settings           GET, PUT
/api/admin/migrate      POST — run DB migrations
```

---

## Key Design Decisions

- **No Supabase Auth** — custom session system to keep it simple and avoid email verification friction
- **Service role key** — used server-side only (API routes), never exposed to client
- **Build-time safety** — Supabase client uses placeholder values when env vars missing (so `next build` doesn't fail)
- **Purchase type** — transactions can be type `purchase` (in addition to `income`/`expense`), used for weekly member purchases
- **Invoice auto-generation** — `/api/invoices/generate` combines member charges + purchase transactions into invoices with Hebrew period labels

---

## Session Log

### Session 1 — 2026-03-08 ~23:27 UTC+1 (Yesterday night)

**What was built:**
- Initial Next.js 14 project scaffolded from scratch
- Core pages: Dashboard, Transactions, Categories, Reports
- Bilingual system: Hebrew/English with RTL layout (`lib/i18n.ts`, `lib/LangContext.tsx`)
- Type definitions (`lib/db.ts`)
- Attempted sql.js for local SQLite DB — scaffolded all API routes (transactions, categories, export, reports)
- Multiple fix attempts for sql.js integration (4 fix commits — wasm loading issues in Next.js)

---

### Session 2 — 2026-03-09 ~01:29–02:19 UTC+1 (Yesterday night / early morning)

**What was built:**
- **Auth system** — login/logout, cookie sessions, PBKDF2 password hashing, middleware route protection
- **Members management** — member list, charges, payments, balance tracking
- **Euro currency** support added
- **Migrated from sql.js → Supabase PostgreSQL** — rewrote all API routes, added `lib/supabase.ts` with seeding
- Fixed Vercel build failure: Supabase client uses placeholder env vars at build time
- **Major feature batch** (commit `fb05cbd`):
  - Donors module (list + donation history)
  - Invoices module (create, manage, line items)
  - Recurring transactions (templates + auto-generate)
  - Weekly Purchases page (grouped by week with Shabbat parasha labels)
  - Member CSV import
  - Hebrew calendar integration (`lib/hebrewDate.ts` using `@hebcal/core`)
  - Fixed hebcal constant: `SHEVAT` → `SHVAT`
  - Fixed TypeScript: `InvoiceItem` type conflict in invoices page

---

### Session 3 — 2026-03-09 ~13:35–14:16 UTC (Today noon)

**What was built:**
- **Monthly fee** — bulk charge monthly fee to all active members at once (`/api/members/monthly-fee`)
- **Auto-invoices** — generate invoices for a date range from member charges + purchase transactions (`/api/invoices/generate`)
- **Shabbat labels** in weekly purchases (parasha name / Yom Tov shown per week)
- **Purchase types** — `purchase` added as third transaction type (alongside `income`/`expense`)
- **User profile page** — change display name + password (`/profile`, `/api/auth/profile`)
- **Invoice settings** — organization details configurable in settings page
- **Purchase type categories** — categories can now be typed as `purchase`
- **Parasha labels** in invoice/purchase UI
- **EUR currency** — euro symbol support alongside shekel
- Fixed TypeScript error: `purchase` type missing from transactions form union type

---

### Session 4 — 2026-03-09 (Today, current session)

**What was done:**
- Analyzed full codebase and produced overview (tech stack, architecture, entry points)
- Created this `CLAUDE.md` file for persistent session logging
- Reconstructed previous session history from git log

**Status:** Ready for new feature development. User has more features and changes planned.

---

*This file is updated at the end of every session. Always read it at the start of a new session to restore context.*
