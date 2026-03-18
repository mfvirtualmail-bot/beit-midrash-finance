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

### Session 4 — 2026-03-09

**What was done:**
- Analyzed full codebase and produced overview (tech stack, architecture, entry points)
- Created this `CLAUDE.md` file for persistent session logging
- Reconstructed previous session history from git log

---

### Session 5 — 2026-03-09 → 2026-03-10

**Branch:** `claude/explain-codebase-mmjlcou6tgfd23su-fnzDp` (merged to main via PR #1)

**What was built (commit `94a38b3`):**
- **Single-input fields fix** — replaced dual-language input fields (Hebrew + English side by side) with single input fields throughout the app. Before this, forms had two inputs for every text field (one Hebrew, one English), which was confusing. Now each field is a single input.

**What was built (commit `6390233`):**
- **Hebrew Calendar page** — new `/hebrew-calendar` page showing the Hebrew calendar
- **Improved purchases week selector** — better week navigation in the purchases page

**PR #1 created and merged** — merged `claude/explain-codebase-mmjlcou6tgfd23su-fnzDp` into `main`

---

### Session 6 — 2026-03-10

**Branch:** `claude/explain-date-codebase-3glPM`

**What was built (commit `6e9b8d9`):**

1. **Collectors/Agents module** — Full new module for managing donation collectors (גבאי/סוכן):
   - New page: `/collectors` — list, add, edit, delete collectors
   - New API routes: `/api/collectors` (GET, POST), `/api/collectors/[id]` (GET, PUT, DELETE)
   - New DB table: `collectors` (name, phone, email, commission_percent, notes, active, timestamps)
   - DB migration added to `/api/admin/migrate` (v3 migration)
   - New types in `lib/db.ts`: `Collector` interface
   - Collectors can be assigned to donations — donor detail page (`/donors/[id]`) updated with collector dropdown
   - Commission % displayed on donations
   - i18n strings added for collectors in Hebrew and English

2. **Clean PDF/Print invoices** — Print CSS improvements in `app/layout.tsx`:
   - Added `@media print` styles for clean A4 output
   - Hides navigation, buttons, non-essential UI when printing
   - Forces color printing (`-webkit-print-color-adjust: exact`, `print-color-adjust: exact`)
   - Invoice page gets full width when printed

3. **Removed quantity from invoices** — Simplified invoice line items:
   - Invoice detail page (`/invoices/[id]`) no longer shows quantity or unit price columns
   - Just shows description + amount per line item
   - Invoice creation form also simplified (no quantity/unit_price inputs)

4. **Parasha labels in auto-generated invoices** — When invoices are auto-generated via `/api/invoices/generate`:
   - Purchase transactions now include the Shabbat parasha name in their description
   - Uses `getWeekLabel()` from `lib/hebrewDate.ts` to get parasha for the purchase date
   - Format: "Purchase: CategoryName (פרשת ...)"

5. **Hebrew year gematria fix** — Fixed `lib/hebrewDate.ts`:
   - Previous implementation used `HDate.renderGematriya()` and tried to parse it — was buggy
   - New implementation: custom `numberToHebrewYear()` function that directly converts year numbers to Hebrew gematria
   - Handles hundreds (ק-תת), tens (י-צ), ones (א-ט), and special cases (טו→ט״ו, טז→ט״ז)
   - Strips the thousands (5000) since Hebrew calendar years omit the millennium
   - Added proper geresh (׳) and gershayim (״) punctuation

**Files changed:**
- `app/api/admin/migrate/route.ts` — added v3 migration for collectors table
- `app/api/collectors/route.ts` — NEW: GET/POST for collectors
- `app/api/collectors/[id]/route.ts` — NEW: GET/PUT/DELETE for single collector
- `app/api/donors/[id]/donations/route.ts` — added collector_id to donation creation
- `app/api/donors/[id]/route.ts` — added collector info to donor detail response
- `app/api/invoices/generate/route.ts` — added parasha labels to purchase descriptions
- `app/collectors/page.tsx` — NEW: full collectors management page
- `app/donors/[id]/page.tsx` — added collector dropdown to donation form
- `app/invoices/[id]/page.tsx` — removed quantity/unit_price, simplified display
- `app/invoices/page.tsx` — simplified invoice creation form
- `app/layout.tsx` — added print CSS for clean PDF output
- `lib/db.ts` — added Collector type
- `lib/hebrewDate.ts` — rewrote Hebrew year conversion, added numberToHebrewYear()
- `lib/i18n.ts` — added collector-related i18n strings
- `supabase-schema.sql` — added collectors table definition + v3 migration comment

**Deployment status:**
- Code is pushed to GitHub on branch `claude/explain-date-codebase-3glPM`
- Attempted to merge to `main` for Vercel deploy but got 403 (branch protection or permission issue)
- Local `main` branch was fast-forward merged but push was rejected
- **User needs to manually merge to `main`** via GitHub PR to trigger Vercel deployment
- **After deploy:** run `POST /api/admin/migrate` to create the `collectors` table in Supabase

**Current git state:**
- On branch `claude/explain-date-codebase-3glPM` (up to date with origin)
- Local `main` is at `6e9b8d9` (same as feature branch) but couldn't push
- 1 commit ahead of remote `main`: `6e9b8d9`

**What the user asked at end of session:**
- "Push the code on GitHub and on the server" — code is on GitHub (feature branch), but can't push to main directly. User needs to merge PR or push to main themselves.

---

## App Modules / Pages (Updated)

| Route | Description |
|---|---|
| `/collectors` | **NEW** — Collector/agent list — manage donation collectors with commission % |

## API Routes (Updated)

```
/api/collectors         GET, POST — list/create collectors
/api/collectors/[id]    GET, PUT, DELETE — single collector CRUD
```

## Database Tables (Updated)

### collectors (NEW — v3 migration)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, auto-generated |
| name | text | NOT NULL |
| phone | text | nullable |
| email | text | nullable |
| commission_percent | numeric(5,2) | default 0 |
| notes | text | nullable |
| active | boolean | default true |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

---

### Session 7 — 2026-03-10 (current)

**Branch:** `claude/explain-date-codebase-3glPM` (continuing from session 6)

**User requested 7 features/changes:**

1. **Organization logo everywhere** — User attached logo image (בית המדרש תולדות יעקב יוסף דחסידי סקווירא אמסטרדם יצ"ו). Add to: login page, dashboard/main page, invoices, and all other prominent places. Save as `public/logo.png`.

2. **Remove nikud (נקודות) from parasha names** — Currently parasha names show with vowel marks: פָּרָשַׁת כִּי תִשָּׂא (שַׁבַּת פָּרָה). Strip all nikud to show plain: פרשת כי תשא (שבת פרה). Fix in `lib/hebrewDate.ts` — add a stripNikud function that removes Unicode range \u0591-\u05C7 from strings returned by hebcal.

3. **Excel import for bulk purchases** — New page/feature: upload an Excel (.xlsx) file to import purchases for many members at once. Similar to existing `/members/import` CSV import but for purchases. Needs: new page `/purchases/import`, new API route `/api/purchases/import` (POST), Excel parsing with `xlsx` package (already in project), mapping columns to member + category + amount + date.

4. **Checklist / multi-select on all lists** — Add checkboxes to all list pages (purchases, members, transactions, donors, collectors, invoices). When items are selected, show a toolbar/action bar with batch operations: delete selected, edit selected (where applicable). Affects: `/transactions`, `/purchases`, `/members`, `/donors`, `/collectors`, `/invoices`.

5. **Monthly fee — choose which month** — The "charge all members monthly fee" feature (`/api/members/monthly-fee`) currently charges for the current month. Add a dropdown to select which month to charge for (including previous months, e.g. last 12 months). The dropdown should show Hebrew month names. The charge description should include which month it's for.

6. **Hebrew calendar always in Hebrew** — The `/hebrew-calendar` page should always render in Hebrew (month names, day names, parasha names) regardless of the app's current language setting. Force `he` locale for all calendar display elements.

7. **PDF invoices** — Generate actual downloadable PDF files for invoices. Options: use a library like `jspdf` or `@react-pdf/renderer` or server-side PDF generation. Should produce a clean A4 PDF with: organization logo, organization details from settings, invoice number, date, line items, total, Hebrew text support (RTL).

**All 7 features built and committed (commit `d7077f8`).**

**What was built:**

1. **Logo** — `<img src="/logo.png">` added to: `app/login/page.tsx` (login form header), `app/page.tsx` (dashboard header), `app/layout.tsx` (sidebar/header nav), `app/invoices/[id]/page.tsx` (invoice detail header). **User must place their logo image at `public/logo.png`** — the code references this file but I couldn't save the image from the conversation.

2. **Strip nikud** — Added `stripNikud()` function to `lib/hebrewDate.ts` (removes Unicode \u0591-\u05C7). Applied to all returns from `getShabbatOrHolidayLabel()`. Also applied in `app/calendar/page.tsx` to holiday event rendering.

3. **Hebrew calendar always Hebrew** — `app/calendar/page.tsx`: forced day names to always use `DAY_NAMES_HE`, month names to always use `nameHe`, parasha/holiday labels to always show Hebrew. Gregorian dates in holidays sidebar forced to `he-IL` locale.

4. **Monthly fee month selector** — `app/api/members/monthly-fee/route.ts`: GET accepts `?month=X&year=Y` query params, returns `availableMonths` array (current + previous Hebrew year). POST accepts `{ month, year }` in body. `app/members/page.tsx`: added month dropdown in fee modal, loads available months from API, updates preview when month changes.

5. **Multi-select checkboxes** — Added to 5 list pages: `app/transactions/page.tsx`, `app/members/page.tsx`, `app/donors/page.tsx`, `app/collectors/page.tsx`, `app/invoices/page.tsx`. Each has: select-all checkbox in header, per-row checkbox, batch action bar (shows count + delete button when items selected), blue highlight on selected rows.

6. **Excel import for bulk purchases** — New files:
   - `app/api/purchases/import/route.ts` — POST endpoint, parses xlsx/xls/csv, matches member names to existing members in DB, creates expense transactions
   - `app/purchases/import/page.tsx` — drag-and-drop upload page with instructions table
   - `app/purchases/page.tsx` — added "Import from Excel" button linking to import page
   - Expected columns: member (required), amount (required), category, date, notes

7. **PDF invoices** — `app/api/invoices/pdf/route.ts`: GET endpoint (`/api/invoices/pdf?id=X`) returns complete HTML page with RTL Hebrew layout, organization logo, settings-based org details, line items table, print-optimized CSS with `@page` A4 setup. Opens in new tab with "Print/Download PDF" button. `app/invoices/[id]/page.tsx`: "Download PDF" button now opens this endpoint instead of calling `window.print()`.

**Files changed/created:**
- Modified: `lib/hebrewDate.ts`, `app/layout.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/calendar/page.tsx`, `app/transactions/page.tsx`, `app/members/page.tsx`, `app/donors/page.tsx`, `app/collectors/page.tsx`, `app/invoices/page.tsx`, `app/invoices/[id]/page.tsx`, `app/purchases/page.tsx`, `app/api/members/monthly-fee/route.ts`, `package.json`, `package-lock.json`
- Created: `app/api/invoices/pdf/route.ts`, `app/api/purchases/import/route.ts`, `app/purchases/import/page.tsx`
- Dependencies added: `jspdf` (installed but not actively used — PDF is done via HTML rendering instead)

**IMPORTANT for deployment:**
- User must place logo image file at `public/logo.png` before deploying
- Need to merge branch `claude/explain-date-codebase-3glPM` to `main` for Vercel deploy
- Run `POST /api/admin/migrate` after deploy (for collectors table from session 6)

**Git state:** On branch `claude/explain-date-codebase-3glPM`, pushed to origin. 3 commits ahead of remote main.

---

### Session 8 — 2026-03-10

**Branch:** `claude/explain-date-codebase-3glPM` (continuing)

**Bugs fixed (2 commits: `17b64b3`, `f62c813`):**

1. **Invoice generation returning 0 invoices** — Root cause: `members.active` column is `integer` (1/0), but `/api/invoices/generate/route.ts` used `.eq('active', true)` (boolean). PostgreSQL doesn't match `integer 1 = boolean true`, so the query returned **zero members** → zero invoices generated. Fixed to `.eq('active', 1)`.

2. **Invoice purchase period labels always showing wrong parasha** — The invoice generation code was computing a new parasha label via `getShabbatOrHolidayLabel()` for every purchase, but it always returned the current week's parasha ("פרשת ויקהלפקודי שבת החדש") instead of the purchase's actual date. The fix: purchase transactions' `description_he` already contains the correct "period - item" format (e.g., "יום כיפור - כהן", "פרשת האזינו - שלישי"). Now the code uses this directly instead of overwriting it with a computed (wrong) label.

3. **Member detail page not showing purchases** — `/api/members/[id]/route.ts` only returned `member_charges` and `member_payments`. Added query for `transactions` where `member_id` matches and `type IN ('expense', 'purchase')`. New `purchases` array returned in API response. Member detail page (`app/members/[id]/page.tsx`) now shows a "רכישות" (Purchases) section with orange-themed table between charges and payments.

4. **No "generate invoice" button on members list page** — Added a purple FileText icon button per member row on `/members` page. Clicking navigates to `/members/[id]#invoice` which auto-opens the invoice generation modal.

5. **Invoices list API error handling** — Added error logging to `/api/invoices/route.ts` GET handler. Previously errors were silently swallowed and returned empty array.

6. **Added v5 migration: transactions 'purchase' type** — The `transactions` table CHECK constraint only allowed `('income', 'expense')`. Added migration to allow `'purchase'` type: `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check; ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'purchase'));`

**Files changed:**
- `app/api/invoices/generate/route.ts` — fixed `.eq('active', 1)`, fixed purchase description to use existing description_he
- `app/api/invoices/route.ts` — added error logging
- `app/api/members/[id]/route.ts` — added purchases query, included in response
- `app/members/[id]/page.tsx` — added purchases interface, purchases section UI, auto-open invoice modal on #invoice hash
- `app/members/page.tsx` — added FileText icon, generate invoice button per member row
- `app/api/admin/migrate/route.ts` — added v5 migration for transactions purchase type

**SQL migrations added (v5):**
```sql
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'purchase'));
```

**Known issue:** `members.active` column is `integer` (not `boolean`). All queries checking active status must use `.eq('active', 1)` not `.eq('active', true)`. The `donors`, `collectors`, `recurring_transactions` tables use `boolean` for active — those are fine with `.eq('active', true)`.

**Git state:** On branch `claude/explain-date-codebase-3glPM`, pushed to origin. 5 commits ahead of remote main.

---

### Session 9 — 2026-03-11

**Branch:** `claude/review-and-continue-L6wRp` (continuing from sessions 7-8)

**Previous session (context compacted) built:**
- **Payments module** — New `/payments` page with manual entry (searchable member dropdown, amount, date, method, hebrew date field, notes), batch delete, Excel/CSV bulk import (`/payments/import`). API routes: `/api/payments` (GET, POST), `/api/payments/import` (POST).
- **Invoices → Statements rebrand** — All "Invoice" (חשבונית) references renamed to "Statement" (דף חשבון) throughout the entire app (UI, API, i18n strings).
- **Unified financial view** — Statements combine charges (monthly fees + purchases) and payments in one chronological 4-column table with balance summary.
- **Bulk PDF** — Select multiple members → generate single PDF with page breaks per member.

**What was built in this session (commit `b94d289`):**

1. **Statement column formatting per type** — The 4-column statement table now shows properly formatted Period and Description columns based on line type:
   - **Memberships**: Period = Hebrew month+year (e.g. "תשרי תשפ״ו"), Description = "דמי חבר"
   - **Purchases**: Period = parasha/holiday name (e.g. "פרשת שמות", "יום כיפור"), Description = item name (e.g. "שלש סעודות", "מנחה")
   - **Payments**: Period = Gregorian date (e.g. "2026-03-10"), Description = "תשלום - העברה בנקאית"
   - Column headers changed from "תאריך / תקופה" to "תקופה / שבוע" (Period/Week)

2. **Direct PDF download** — Added `download=1` query parameter to `/api/statements/pdf`. When present, JavaScript auto-triggers the browser's print/save dialog on page load (via `window.print()` after 500ms). All download buttons now use this parameter.

3. **Bulk PDF download** — Multiple members compiled into a single HTML page with `page-break-after: always` CSS per member. Both bulk download button and per-member download button use `download=1`.

4. **Member payments as income in Reports** — `/api/reports/route.ts` now fetches `member_payments` alongside `transactions`. Payments are:
   - Added to monthly income totals in bar chart
   - Shown as a special "תשלומי חברים" (Member Payments) category in income pie chart (green #22c55e)
   - Included in summary total_income
   - Payment years included in year selector

5. **Member payments as income in Transactions** — `/api/transactions/route.ts` now fetches `member_payments` and injects them as virtual income entries with:
   - ID format: `payment-{id}` (to distinguish from real transactions)
   - Type: `income`
   - Description: "תשלום - {member name} - {method}"
   - Category: "תשלומי חברים" with green badge
   - Not editable/deletable from transactions page (shows "תשלום חבר" label instead of edit/delete buttons)
   - Batch delete skips payment entries

6. **Exported `yearToGematriya`** — Made the Hebrew year gematria function public in `lib/hebrewDate.ts` so it can be imported by statements API.

**Files changed:**
- `lib/hebrewDate.ts` — exported `yearToGematriya` function
- `app/api/statements/route.ts` — complete rewrite: lines now have `period`, `description`, `lineType` fields instead of `hebrewDate`
- `app/api/statements/pdf/route.ts` — same period/description formatting, added auto-print JS script for `download=1`
- `app/api/reports/route.ts` — added member_payments as income in monthly, byCategory, summary, and years
- `app/api/transactions/route.ts` — added member_payments as virtual income entries, METHOD_LABELS constant
- `app/invoices/page.tsx` — bulk download uses `download=1` param
- `app/invoices/[id]/page.tsx` — updated StatementLine interface (period field), download button uses `download=1`
- `app/transactions/page.tsx` — payment entries show "תשלום חבר" label, batch delete skips payment-* IDs

**Git state:** On branch `claude/review-and-continue-L6wRp`, pushed to origin. User created PR manually.

---

### Session 10 — 2026-03-12

**Branch:** `claude/member-statements-pdf-engine-GtTxl`

**What was built (sessions 10a-10c, multiple commits):**

1. **Dynamic member statements** — Replaced "Generate Statement" with "View Statement" modal on `/invoices` page. Year dropdown refreshes data immediately. Uses `useSearchParams()` wrapped in Suspense.

2. **Payment CRUD** — Full edit modal on member detail page and payments page. Payment method is a dropdown (cash/check/bank/credit_card) that defaults to blank.

3. **Rich text header/footer editor** — React-Quill integration in Settings page. Custom HTML header/footer saved to `settings` table keys `statement_header_html` / `statement_footer_html`. Injected into PDF output.

4. **PDF pagination** — `page-break-inside: avoid` on table rows, totals, balance, and footer blocks.

5. **Fix: payment method no longer defaults to 'cash'** — Comprehensive fix across ALL code paths:
   - `/api/payments/route.ts` POST: `method: method || null`
   - `/api/members/[id]/payments/route.ts` POST: `method: method || null`
   - `/api/members/[id]/payments/[paymentId]/route.ts` PUT: `method: method || null`
   - `/api/payments/import/route.ts`: `normalizeMethod()` returns `null` for unknown, caller defaults to `null`
   - `/api/transactions/route.ts`: handles null method gracefully in payment descriptions
   - `/api/statements/route.ts` and `/api/statements/pdf/route.ts`: null method → blank description (just "תשלום" not "תשלום - מזומן")
   - `app/payments/page.tsx`: form sends `method: form.method || null`, dropdown defaults to empty
   - `app/members/[id]/page.tsx`: payment form sends `method || null`
   - v6 migration: `ALTER TABLE member_payments ALTER COLUMN method DROP NOT NULL; DROP DEFAULT;`
   - v7 migration: `UPDATE member_payments SET method = NULL WHERE method = 'cash';` — cleans up ALL existing rows

**CRITICAL: After deploy, run `POST /api/admin/migrate`** to:
- Make `member_payments.method` column nullable (v6)
- Set all existing 'cash' values to NULL (v7)

**Files changed:**
- `app/api/admin/migrate/route.ts` — added v6+v7 migrations
- `app/api/members/[id]/payments/route.ts` — method null fix
- `app/api/members/[id]/payments/[paymentId]/route.ts` — method null fix on PUT
- `app/api/payments/route.ts` — method null fix
- `app/api/payments/import/route.ts` — normalizeMethod returns null, type fix
- `app/api/transactions/route.ts` — null method in payment descriptions
- `app/api/statements/route.ts` — null method handling
- `app/api/statements/pdf/route.ts` — null method handling, rich header/footer, pagination CSS
- `app/api/settings/route.ts` — added statement_header_html/footer_html defaults
- `app/payments/page.tsx` — method sends null, dropdown defaults blank
- `app/members/[id]/page.tsx` — payment edit modal, method null
- `app/invoices/page.tsx` — dynamic statement modal with year dropdown
- `app/settings/page.tsx` — React-Quill rich text editors
- `components/RichTextEditor.tsx` — new component
- `package.json` — added react-quill

**Known issue:** `member_payments.method` DB column is `NOT NULL DEFAULT 'cash'` until v6+v7 migration runs. All code now sends `null` for empty method, but the DB will reject it until migration runs.

**Git state:** On branch `claude/member-statements-pdf-engine-GtTxl`, pushed to origin.

---

---

### Session 11 — 2026-03-18

**Branch:** `claude/update-payment-method-cash-v0qLz`

**What was done:**

1. **Payment method 'cash' → 'unknown'** — All previously imported payments were falsely marked as `cash` because the DB column had `DEFAULT 'cash'`. Fixed across all layers:
   - `supabase-schema.sql` — column default changed: `method text default 'unknown'`
   - `app/api/admin/migrate/route.ts` — added **v9 migration**:
     ```sql
     ALTER TABLE member_payments ALTER COLUMN method SET DEFAULT 'unknown';
     UPDATE member_payments SET method = 'unknown' WHERE method = 'cash';
     ```
   - Note: v7 (cash→NULL) and v8 (NULL/cash→unknown) were already present from session 10. v9 is the final cleanup + default change.

2. **Replace Resend with Gmail SMTP** — Full email system rewrite using Nodemailer:
   - `lib/email.ts` — replaced `Resend` client with `nodemailer.createTransport()` using `smtp.gmail.com:465` (SSL)
   - Credentials pulled from settings DB: `gmail_user`, `gmail_app_password`, `email_sender_name`
   - Fallback to env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
   - Statement email subject: `דף חשבון מעודכן - [Member Name]`
   - Statement body opening: `שלום [Name], מצורף דף החשבון שלך. יתרה נוכחית: [Balance].`
   - Payment confirmation: method shown only if known (not blank/unknown)
   - `package.json` — removed `resend@^6.9.4`, added `nodemailer@^6.9.16` + `@types/nodemailer`

3. **Gmail Settings UI** — Settings page (`app/settings/page.tsx`) updated:
   - Removed: Resend API Key field, Sender Email field
   - Added: Gmail Address field (`gmail_user`), Google App Password field (`gmail_app_password`, masked), Sender Display Name field (`email_sender_name`)
   - Helper text: "Create App Password at myaccount.google.com → Security → App Passwords"

4. **Settings API** — `app/api/settings/route.ts` DEFAULTS updated:
   - Removed: `resend_api_key`, `email_sender`
   - Added: `gmail_user`, `gmail_app_password`, `email_sender_name`

5. **Payment confirmation passes method** — `app/api/email/payment-confirmation/route.ts` now accepts and forwards `payment_method` from request body to `sendPaymentConfirmationEmail()`.

**Files changed:**
- `lib/email.ts` — full rewrite: Nodemailer Gmail SMTP
- `app/api/settings/route.ts` — replaced resend keys with gmail keys
- `app/settings/page.tsx` — Gmail SMTP settings UI (3 new fields)
- `app/api/email/payment-confirmation/route.ts` — passes payment_method
- `app/api/admin/migrate/route.ts` — v9 migration
- `supabase-schema.sql` — column default 'unknown'
- `package.json` / `package-lock.json` — resend removed, nodemailer added

**AFTER DEPLOY:**
1. Run `POST /api/admin/migrate` — applies v9 (all 'cash' → 'unknown', default changed)
2. Go to Settings → Email Settings → enter Gmail address + App Password + Sender Name

**Known deployment note:** Direct push to `main` is blocked (403). User must merge PR manually on GitHub. The local `main` branch has all changes merged but remote `main` requires manual PR merge via GitHub UI.

**Git state:** On branch `claude/update-payment-method-cash-v0qLz`, pushed to origin. Awaiting manual PR merge to main.

---

## GitHub Access

- **GitHub PAT** is stored locally at `~/.github-token` (not committed to repo — blocked by GitHub secret scanning)
- Token belongs to the repo owner (mfvirtualmail-bot)
- **Note:** Direct push to `main` always fails with 403 — branch is protected. Always merge via GitHub PR.
- **Note:** `gh` CLI is NOT installed. GitHub API calls via `curl` fail (no valid token accessible). The local proxy at `127.0.0.1:39157` only handles git push/pull, NOT GitHub API calls.

---

## ⚠️ SKILL: MANUAL-PR — How to Create a Pull Request in This Project

**Skill name:** `MANUAL-PR`

**When to use:** Every time a feature branch is ready and needs to be merged to `main`.

**The ONLY working method — direct GitHub URL:**

1. After pushing the branch, give the user this URL:
   ```
   https://github.com/mfvirtualmail-bot/beit-midrash-finance/compare/main...<branch-name>
   ```
   Replace `<branch-name>` with the actual branch (e.g. `claude/update-payment-method-cash-v0qLz`).

2. User clicks that link → clicks **"Create pull request"** → clicks **"Merge pull request"**.

**What NEVER works (do not waste time trying):**
- `git push origin main` → always 403 (branch protection)
- `gh pr create` → `gh` CLI not installed
- `curl` to GitHub API → no valid token available
- Any path on `127.0.0.1:39157` other than git push/pull → "Invalid path format"

**Template message to give user:**
> Please open this link to create the PR and merge it:
> `https://github.com/mfvirtualmail-bot/beit-midrash-finance/compare/main...<branch-name>`

---

*This file is updated at the end of every session. Always read it at the start of a new session to restore context.*
