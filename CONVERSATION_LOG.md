# Conversation Log — Beit Midrash Finance

> **Purpose:** Detailed record of every conversation, request, decision, bug report, and implementation detail across all development sessions. This is the "full story" — CLAUDE.md has the summary, this file has everything.
>
> **Last updated:** 2026-03-16 (Session 11)

---

## Table of Contents

1. [Session 1 — Project Bootstrap](#session-1--project-bootstrap)
2. [Session 2 — Auth, Members, Supabase Migration](#session-2--auth-members-supabase-migration)
3. [Session 3 — Monthly Fees, Auto-Invoices, Profile](#session-3--monthly-fees-auto-invoices-profile)
4. [Session 4 — Documentation](#session-4--documentation)
5. [Session 5 — UX Fixes, Hebrew Calendar Page](#session-5--ux-fixes-hebrew-calendar-page)
6. [Session 6 — Collectors, PDF Print, Gematria Fix](#session-6--collectors-pdf-print-gematria-fix)
7. [Session 7 — 7 Feature Batch (Logo, Nikud, Excel Import, Multi-select, Month Selector, Calendar, PDF)](#session-7--7-feature-batch)
8. [Session 8 — Bug Fixes (Invoice Generation, Purchases, Migrations)](#session-8--bug-fixes)
9. [Session 9 — Payments Module, Statements Rebrand, Reports Integration](#session-9--payments-module-statements-rebrand)
10. [Session 10 — Dynamic Statements, Payment CRUD, Rich Text Editor, Method Fix](#session-10--dynamic-statements-payment-crud-rich-text)
11. [Session 11 — Email Integration (Resend)](#session-11--email-integration-resend)
12. [Known Issues & Technical Debt](#known-issues--technical-debt)
13. [User Preferences & Patterns](#user-preferences--patterns)
14. [Deployment Checklist](#deployment-checklist)
15. [Credentials & Access](#credentials--access)

---

## Session 1 — Project Bootstrap

**Date:** 2026-03-08 ~23:27 UTC+1
**Branch:** `main`

### What the user asked:
- Build a financial management web app for a Beit Midrash (Jewish study institution)
- Hebrew + English bilingual support
- Track income, expenses, categories, reports

### What was built:
- Next.js 14 App Router project from scratch
- Core pages: Dashboard (`/`), Transactions (`/transactions`), Categories (`/categories`), Reports (`/reports`)
- Bilingual system with RTL support (`lib/i18n.ts`, `lib/LangContext.tsx`)
- TypeScript type definitions (`lib/db.ts`)
- Initially tried `sql.js` for local SQLite database — had 4 fix commits for WASM loading issues in Next.js (never fully resolved)

### Technical decisions:
- Next.js 14 with App Router (not Pages Router)
- Tailwind CSS for styling
- Lucide for icons
- Recharts for charts
- Euro (€) as default currency

### Problems encountered:
- sql.js WASM loading failed in Next.js serverless environment — would be replaced by Supabase in Session 2

---

## Session 2 — Auth, Members, Supabase Migration

**Date:** 2026-03-09 ~01:29–02:19 UTC+1
**Branch:** `main`

### What the user asked:
- Add authentication (login system)
- Add member management (charges, payments, balances)
- Fix the database issues from Session 1

### What was built:
1. **Auth system** — Custom session-based auth (not Supabase Auth):
   - Login/logout with cookie sessions
   - PBKDF2 with SHA-512 password hashing (10k iterations)
   - Middleware route protection (all routes except `/login` and `/api/auth/*`)
   - Default users seeded: `admin/admin123`, `user1/1234`, `user2/1234`

2. **Members management** — Full CRUD:
   - Member list with balance tracking
   - Per-member charges and payments
   - Balance = payments - charges

3. **Database migration: sql.js → Supabase PostgreSQL**:
   - Rewrote ALL API routes from SQLite to Supabase
   - Created `lib/supabase.ts` with service role key (server-side only)
   - Auto-seeding of default data on first run

4. **Major feature batch** (commit `fb05cbd`):
   - Donors module (list + donation history)
   - Invoices module (create, manage, line items)
   - Recurring transactions (templates + auto-generate)
   - Weekly Purchases page (grouped by Shabbat week with parasha labels)
   - Member CSV import
   - Hebrew calendar integration (`lib/hebrewDate.ts` using `@hebcal/core`)

### Key design decisions:
- **Why no Supabase Auth?** Keep it simple, avoid email verification friction. The Beit Midrash doesn't need OAuth/magic links — just simple username/password for a few trusted users.
- **Service role key** used server-side only — never exposed to client
- **Build-time safety** — Supabase client uses placeholder values when env vars are missing so `next build` doesn't fail on Vercel

### Bugs fixed:
- hebcal constant: `SHEVAT` → `SHVAT` (wrong enum name)
- TypeScript: `InvoiceItem` type conflict in invoices page
- Vercel build failure: env vars not available at build time

---

## Session 3 — Monthly Fees, Auto-Invoices, Profile

**Date:** 2026-03-09 ~13:35–14:16 UTC

### What the user asked:
- Ability to charge monthly membership fees to all members at once
- Auto-generate invoices from charges/purchases for a date range
- User profile page
- Organization settings for invoices

### What was built:
1. **Monthly fee** — `POST /api/members/monthly-fee` charges all active members at once
2. **Auto-invoices** — `POST /api/invoices/generate` combines member charges + purchase transactions into invoices with Hebrew period labels
3. **Purchase types** — `purchase` added as third transaction type (alongside `income`/`expense`)
4. **User profile page** — `/profile` with change display name and password
5. **Invoice settings** — organization details configurable in settings
6. **EUR currency** — euro symbol support

### Bug fixed:
- TypeScript error: `purchase` type missing from transactions form union type

---

## Session 4 — Documentation

**Date:** 2026-03-09

### What was done:
- Full codebase analysis and overview
- Created `CLAUDE.md` for persistent session logging
- Reconstructed all previous session history from git log

---

## Session 5 — UX Fixes, Hebrew Calendar Page

**Date:** 2026-03-09 → 2026-03-10
**Branch:** `claude/explain-codebase-mmjlcou6tgfd23su-fnzDp`
**PR:** #1 (merged to main)

### What the user asked:
- The dual-language input fields (Hebrew + English side by side) are confusing — simplify
- Add a Hebrew calendar view

### What was built:
1. **Single-input fields fix** — Replaced dual-language input fields with single input fields throughout the app. Before: every form had two inputs per text field (Hebrew + English). After: one input per field.
2. **Hebrew Calendar page** — New `/hebrew-calendar` page showing the full Hebrew calendar
3. **Improved purchases week selector** — Better week navigation in purchases page

---

## Session 6 — Collectors, PDF Print, Gematria Fix

**Date:** 2026-03-10
**Branch:** `claude/explain-date-codebase-3glPM`

### What the user asked:
- Add a Collectors/Agents module for managing donation collectors with commission tracking
- Make invoices printable as clean PDFs
- Fix Hebrew year display (gematria was buggy)
- Remove quantity from invoices (just show description + amount)
- Add parasha labels to auto-generated invoices

### What was built:
1. **Collectors/Agents module** — Full CRUD:
   - `/collectors` page, `/api/collectors` routes
   - DB table: `collectors` (name, phone, email, commission_percent, notes, active)
   - v3 migration in `/api/admin/migrate`
   - Collectors assignable to donations (dropdown in donor detail page)
   - Commission % displayed on donations

2. **Clean PDF/Print invoices** — `@media print` CSS:
   - Hides navigation, buttons, non-essential UI when printing
   - Forces color printing
   - Invoice gets full width when printed

3. **Removed quantity from invoices** — Simplified to just description + amount per line item

4. **Parasha labels in auto-generated invoices** — Purchase transactions include Shabbat parasha name in description

5. **Hebrew year gematria fix** — Complete rewrite of `numberToHebrewYear()`:
   - Custom function converts year numbers to Hebrew gematria directly
   - Handles hundreds (ק-תת), tens (י-צ), ones (א-ט), special cases (טו→ט״ו, טז→ט״ז)
   - Strips the thousands (5000) — Hebrew years omit the millennium
   - Proper geresh (׳) and gershayim (״) punctuation

### Deployment issue:
- Couldn't push to `main` directly (403 — branch protection or permission issue)
- User needs to manually merge PR to trigger Vercel deployment
- After deploy: run `POST /api/admin/migrate` to create collectors table

---

## Session 7 — 7 Feature Batch

**Date:** 2026-03-10
**Branch:** `claude/explain-date-codebase-3glPM` (continuing)

### What the user asked (7 items at once):

1. **Organization logo everywhere** — User attached a logo image for "בית המדרש תולדות יעקב יוסף דחסידי סקווירא אמסטרדם יצ״ו". Add to login, dashboard, invoices, header nav.

2. **Remove nikud (vowel marks) from parasha names** — Currently shows "פָּרָשַׁת כִּי תִשָּׂא". Should be plain "פרשת כי תשא".

3. **Excel import for bulk purchases** — Like the CSV member import, but for bulk purchase transactions from Excel files.

4. **Checklist / multi-select on all lists** — Checkboxes on every list page with batch delete capability.

5. **Monthly fee — choose which month** — The fee modal should let you pick which Hebrew month to charge for (not just current month).

6. **Hebrew calendar always in Hebrew** — The calendar page should always show Hebrew regardless of app language.

7. **PDF invoices** — Generate actual downloadable PDF files (not just print-to-PDF).

### What was built (all 7):

1. **Logo** — Added `<img src="/logo.png">` to login, dashboard, sidebar, invoice detail. User must place logo at `public/logo.png`. Also added logo upload to settings page (stored as base64 in DB via `POST /api/settings/logo`).

2. **Strip nikud** — `stripNikud()` function in `lib/hebrewDate.ts` removes Unicode range \u0591-\u05C7. Applied to all parasha/holiday label returns.

3. **Hebrew calendar always Hebrew** — Forced Hebrew day names, month names, parasha labels regardless of app language.

4. **Monthly fee month selector** — GET `/api/members/monthly-fee` returns `availableMonths` (current + previous Hebrew year). POST accepts `{ month, year }`. UI has month dropdown in fee modal.

5. **Multi-select checkboxes** — Added to 5 pages: transactions, members, donors, collectors, invoices. Each has select-all, per-row checkbox, batch action bar.

6. **Excel import for purchases** — New `/purchases/import` page with drag-and-drop. API `POST /api/purchases/import` parses xlsx/xls/csv, matches member names, creates expense transactions.

7. **PDF invoices** — `GET /api/invoices/pdf` returns complete HTML page with RTL, logo, org details, A4 CSS. Uses html2canvas + jsPDF on client side for actual PDF generation.

### Important note:
- jsPDF was installed but PDF is actually done via HTML rendering + html2canvas on the client side (better Hebrew/RTL support than raw jsPDF)

---

## Session 8 — Bug Fixes

**Date:** 2026-03-10
**Branch:** `claude/explain-date-codebase-3glPM` (continuing)

### Bugs reported and fixed:

1. **Invoice generation returning 0 invoices**
   - Root cause: `members.active` is `integer` (1/0), not `boolean`. Query used `.eq('active', true)` which doesn't match integer 1 in PostgreSQL.
   - Fix: Changed to `.eq('active', 1)`
   - **IMPORTANT GOTCHA**: `members.active` is integer! All queries must use `.eq('active', 1)`. Other tables (`donors`, `collectors`, `recurring_transactions`) use boolean — those work with `.eq('active', true)`.

2. **Invoice purchase period labels showing wrong parasha**
   - The code was computing a new parasha for every purchase but always getting the current week's parasha instead of the purchase date's parasha.
   - Fix: Use the existing `description_he` field which already contains the correct "period - item" format.

3. **Member detail page not showing purchases**
   - API only returned charges and payments, not purchase transactions.
   - Fix: Added query for `transactions` where `member_id` matches and type IN ('expense', 'purchase').

4. **No "generate invoice" button on members list**
   - Added FileText icon button per member row → navigates to `/members/[id]#invoice`.

5. **v5 migration** — Added `purchase` type to transactions CHECK constraint.

---

## Session 9 — Payments Module, Statements Rebrand

**Date:** 2026-03-11
**Branch:** `claude/review-and-continue-L6wRp`

### What the user asked:
- Dedicated payments page (separate from member detail)
- Rename "Invoices" (חשבוניות) → "Statements" (דפי חשבון) throughout the app
- Unified financial view combining charges, purchases, and payments
- Bulk PDF for multiple members

### What was built:

1. **Payments module** — New `/payments` page:
   - Manual entry with searchable member dropdown
   - Amount, date, method (dropdown), Hebrew date field, notes
   - Batch delete
   - Excel/CSV bulk import (`/payments/import`)
   - API: `GET/POST /api/payments`, `POST /api/payments/import`

2. **Invoices → Statements rebrand** — ALL references renamed:
   - "Invoice" → "Statement" / "חשבונית" → "דף חשבון"
   - Throughout UI, API responses, i18n strings, file names

3. **Unified financial view** — Statements combine:
   - Charges (monthly fees + other charges)
   - Purchases (from transactions table)
   - Payments
   - All in one chronological 4-column table with balance summary

4. **Statement column formatting** — Different formatting per line type:
   - **Memberships**: Period = Hebrew month+year, Description = "דמי חבר"
   - **Purchases**: Period = parasha/holiday, Description = item name
   - **Payments**: Period = date, Description = "תשלום - method"

5. **Bulk PDF** — Select multiple members → generate single PDF with page breaks per member

6. **Member payments as income in Reports** — Payments show up in:
   - Monthly income bar chart
   - Income pie chart as "תשלומי חברים" category
   - Summary total_income
   - Year selector

7. **Member payments as income in Transactions** — Virtual income entries:
   - ID format: `payment-{id}` (to distinguish from real transactions)
   - Not editable/deletable from transactions page
   - Batch delete skips payment entries

---

## Session 10 — Dynamic Statements, Payment CRUD, Rich Text

**Date:** 2026-03-12
**Branch:** `claude/member-statements-pdf-engine-GtTxl`

### What the user asked:
- Make statements dynamic (not static generation)
- Full payment edit capability
- Custom header/footer for statements (rich text)
- Fix payment method defaulting to 'cash'

### What was built:

1. **Dynamic member statements** — Replaced "Generate Statement" with "View Statement" modal:
   - Year dropdown refreshes data immediately
   - Uses `useSearchParams()` wrapped in Suspense
   - Real-time data, no pre-generation needed

2. **Payment CRUD** — Full edit modal:
   - On member detail page and payments page
   - Payment method is a dropdown (cash/check/bank/credit_card)
   - Defaults to blank (not 'cash')

3. **Rich text header/footer editor** — React-Quill integration:
   - In Settings page
   - Custom HTML header/footer saved to `settings` table
   - Keys: `statement_header_html`, `statement_footer_html`
   - Injected into PDF output
   - Preview toggle shows live rendering

4. **PDF pagination** — `page-break-inside: avoid` on table rows, totals, balance, footer

5. **Payment method fix** — Comprehensive fix across ALL code paths:
   - Every endpoint now sends `method || null` instead of defaulting to 'cash'
   - v6 migration: made `method` column nullable
   - v7 migration: cleaned up all existing 'cash' values → NULL
   - Statements show blank for null method (just "תשלום" not "תשלום - מזומן")

### Subsequent fix sessions (same branch):
- Made payment method a **required field** (must select before submitting)
- Added 'unknown' option to payment method dropdown
- Hid 'unknown' method label from statements (shows blank like null)

---

## Session 11 — Email Integration (Resend)

**Date:** 2026-03-16
**Branch:** `claude/email-member-statements-t07oB`

### What the user asked:
Full email integration system with 4 components:
1. **Setup** — Use Resend API for email delivery. Configurable sender address in settings. Ensure members have email field.
2. **Manual statement emailing** — "Send Statement via Email" button on member profile/statement page. Attach A4 PDF. Email body: Hebrew-language summary with balance, charges, payments.
3. **Automatic payment notifications** — After payment, show popup "Send email confirmation? [Yes/No]". Content: "We received your payment of [Amount] on [Date]. Balance is now [Balance]."
4. **Email layout** — Hebrew RTL, last 3 transactions table, professional center-aligned design.

### User also provided:
- Resend API key: `re_BiVx7nLi_2sYHeVCZt6dqMEzhuJn3hoMm`

### User feedback during session:
- "PDF generation is currently very slow, especially for bulk (all customers). Takes a few minutes. Not urgent but something to consider." — Acknowledged, noted as future optimization (see Known Issues).

### What was built:

1. **Email utility** (`lib/email.ts`):
   - Resend API integration
   - `sendStatementEmail()` — sends statement with PDF attachment, balance summary, recent activity table
   - `sendPaymentConfirmationEmail()` — sends payment receipt with updated balance, recent activity
   - Both use professional Hebrew RTL email templates with:
     - Organization header (name from settings)
     - Summary cards (charges red, payments green, balance blue/green)
     - Last 3 transactions mini-table
     - Organization footer with phone/email

2. **API routes**:
   - `POST /api/email/send-statement` — accepts multipart/form-data with member_id, optional date_from/date_to, optional PDF file. Generates statement data, sends email with PDF attachment.
   - `POST /api/email/payment-confirmation` — accepts JSON with member_id, payment_amount, payment_date. Calculates current balance, sends confirmation email.

3. **Settings page** — New "Email Settings" section:
   - Resend API key input (password field)
   - Sender email address field
   - Defaults to `onboarding@resend.dev` if no sender configured
   - Falls back to `RESEND_API_KEY` environment variable if not set in DB

4. **Settings API** — Added `resend_api_key` and `email_sender` to settings DEFAULTS whitelist

5. **Member detail page** (`/members/[id]`):
   - Purple "Email Statement" button in header (next to "View Statement")
   - Sends statement email via `/api/email/send-statement`
   - Disabled if member has no email address
   - Success/error message displayed below header
   - After adding a new payment: popup asks "Send confirmation email? [Yes/No]"
   - Only shows popup if member has email address

6. **Payments page** (`/payments`):
   - After recording a new payment: popup asks "Send confirmation email? [Yes/No]"
   - Shows member name and amount in the prompt
   - Sends via `/api/email/payment-confirmation`
   - Loading spinner while sending

7. **Statements page** (`/invoices`):
   - Email button (Send icon) per member row in the table
   - Disabled if member has no email (tooltip shows "No email")
   - Email button in the "View Statement" modal header
   - Success/error message displayed above the table
   - Loading spinner on the specific member's button while sending

8. **i18n strings** — Added for both Hebrew and English:
   - `sendStatementEmail`, `sendingEmail`, `emailSent`, `emailFailed`
   - `sendPaymentConfirmation`, `emailSettings`, `noMemberEmail`

### Files created:
- `lib/email.ts` — Email utility with Resend integration
- `app/api/email/send-statement/route.ts` — Statement email API
- `app/api/email/payment-confirmation/route.ts` — Payment confirmation API

### Files modified:
- `app/api/settings/route.ts` — Added email settings to DEFAULTS
- `app/settings/page.tsx` — Email settings section UI
- `app/members/[id]/page.tsx` — Email button + payment email prompt
- `app/payments/page.tsx` — Payment email prompt
- `app/invoices/page.tsx` — Email buttons per member + in modal
- `lib/i18n.ts` — Email-related strings
- `package.json` — Added `resend` dependency

### Setup required after deploy:
1. Go to Settings page → paste Resend API key
2. Optionally set sender email address
3. Or set `RESEND_API_KEY` as Vercel environment variable
4. Members must have email addresses for email features to work

### How the PDF attachment works:
- The send-statement endpoint can receive a client-generated PDF (via multipart form data)
- If no PDF is provided, it falls back to fetching the statement HTML from `/api/statements/pdf` and attaching it as an HTML file
- The client-side approach (html2canvas + jsPDF) produces better quality PDFs with proper Hebrew rendering

---

## Known Issues & Technical Debt

### Critical gotchas:
1. **`members.active` is integer (1/0), not boolean** — Must use `.eq('active', 1)` not `.eq('active', true)`. Other tables use boolean and work fine with `true`.

2. **Payment method column** — Was `NOT NULL DEFAULT 'cash'` until v6/v7 migrations. Now nullable. All code sends `null` for empty method. Must run migrations after deploy.

3. **PDF generation is slow** — Client-side html2canvas + jsPDF approach is inherently slow, especially for bulk (all members). Takes several minutes for many members. Possible improvements:
   - Server-side PDF with Puppeteer (heavy but high quality)
   - Lighter PDF library that renders HTML directly without canvas
   - Generate PDFs in background/queue instead of blocking UI

### Database migrations:
All migrations are idempotent (safe to re-run). Current migrations through v7:
- v3: Create `collectors` table
- v4: Add `period` column to `invoice_items`
- v5: Allow `purchase` type in transactions
- v6: Make `member_payments.method` nullable
- v7: Clean up existing 'cash' defaults → NULL

After deploying any new code, always run `POST /api/admin/migrate`.

### Environment variables needed:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...  (optional — can also be set in Settings page)
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app  (optional — for email API internal calls)
```

---

## User Preferences & Patterns

### How the user communicates:
- Often gives multiple feature requests in one message (numbered list)
- Provides context in Hebrew and English mixed
- Expects features to work with Hebrew RTL layout
- Prefers Hebrew as the primary UI language
- Gives feedback about bugs/issues as they encounter them
- Wants code pushed to GitHub and deployed

### Design preferences:
- Clean, modern UI with rounded corners (rounded-xl, rounded-2xl)
- Card-based layout (`.card` CSS class)
- Color coding: red for charges/expenses, green for payments/income, blue for balance/info, orange for purchases, purple for actions/collectors
- Professional A4 PDF output with organization branding
- Euro (€) as currency (not shekel)

### Deployment workflow:
- Code pushed to feature branches (can't push to main directly — 403)
- User creates/merges PRs manually on GitHub
- Vercel auto-deploys from main branch
- After deploy: run `POST /api/admin/migrate` from Settings page

---

## Deployment Checklist

After merging any feature branch to main:

1. Verify Vercel build succeeds (auto-deploy)
2. Go to Settings page → "Run Database Migration" button
3. Verify new features work:
   - For email: paste Resend API key in Settings
   - For logo: upload logo in Settings
4. Check Supabase dashboard if migration fails (run SQL manually)

---

## Credentials & Access

### Supabase:
- Project URL: stored in `NEXT_PUBLIC_SUPABASE_URL` env var
- Service role key: stored in `SUPABASE_SERVICE_ROLE_KEY` env var (never expose to client)

### GitHub:
- PAT stored at `~/.github-token` (local only)
- Repo: `mfvirtualmail-bot/beit-midrash-finance`
- Token owner: mfvirtualmail-bot

### Default app users:
- `admin` / `admin123` (administrator)
- `user1` / `1234`
- `user2` / `1234`

### Resend (email):
- API key: `re_BiVx7nLi_2sYHeVCZt6dqMEzhuJn3hoMm`
- Can be set as env var `RESEND_API_KEY` or in Settings page
- Default sender: `onboarding@resend.dev` (Resend's test sender)
- For production: configure custom domain in Resend dashboard

---

## File Map — Quick Reference

### Core libraries:
| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client + seeding + session helper |
| `lib/auth.ts` | Password hashing (PBKDF2), cookie name constant |
| `lib/i18n.ts` | All Hebrew/English UI strings |
| `lib/LangContext.tsx` | React context for language switching |
| `lib/hebrewDate.ts` | Hebrew calendar utilities, gematria, parasha labels, stripNikud |
| `lib/db.ts` | TypeScript interfaces (Member, Transaction, Invoice, etc.) |
| `lib/email.ts` | Resend email functions (statement + payment confirmation) |
| `lib/pdfGenerator.ts` | Client-side PDF generation (html2canvas + jsPDF) |
| `middleware.ts` | Route protection (redirects unauthenticated users to /login) |

### Pages (app directory):
| Route | Page file | Description |
|-------|-----------|-------------|
| `/` | `app/page.tsx` | Dashboard |
| `/login` | `app/login/page.tsx` | Login form |
| `/transactions` | `app/transactions/page.tsx` | All transactions |
| `/categories` | `app/categories/page.tsx` | Category management |
| `/reports` | `app/reports/page.tsx` | Financial reports with charts |
| `/members` | `app/members/page.tsx` | Member list |
| `/members/[id]` | `app/members/[id]/page.tsx` | Member detail (charges, payments, purchases) |
| `/members/import` | `app/members/import/page.tsx` | CSV member import |
| `/donors` | `app/donors/page.tsx` | Donor list |
| `/donors/[id]` | `app/donors/[id]/page.tsx` | Donor detail + donations |
| `/collectors` | `app/collectors/page.tsx` | Collector/agent list |
| `/invoices` | `app/invoices/page.tsx` | Statements list + view modal |
| `/invoices/[id]` | `app/invoices/[id]/page.tsx` | Statement detail |
| `/payments` | `app/payments/page.tsx` | Payments list + add/edit |
| `/payments/import` | `app/payments/import/page.tsx` | Excel payment import |
| `/purchases` | `app/purchases/page.tsx` | Weekly purchases by Shabbat |
| `/purchases/import` | `app/purchases/import/page.tsx` | Excel purchase import |
| `/recurring` | `app/recurring/page.tsx` | Recurring transaction templates |
| `/calendar` | `app/calendar/page.tsx` | Hebrew calendar view |
| `/settings` | `app/settings/page.tsx` | Org settings, logo, email config, migration |
| `/profile` | `app/profile/page.tsx` | User profile (name, password) |

### API routes:
| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Current user |
| `/api/auth/profile` | PUT | Update profile |
| `/api/transactions` | GET, POST | Transaction CRUD |
| `/api/transactions/[id]` | GET, PUT, DELETE | Single transaction |
| `/api/categories` | GET, POST | Category CRUD |
| `/api/categories/[id]` | GET, PUT, DELETE | Single category |
| `/api/members` | GET, POST | Member CRUD |
| `/api/members/[id]` | GET, PUT, DELETE | Single member (with aggregates) |
| `/api/members/[id]/charges` | GET, POST | Member charges |
| `/api/members/[id]/charges/[cid]` | PUT, DELETE | Single charge |
| `/api/members/[id]/payments` | GET, POST | Member payments |
| `/api/members/[id]/payments/[pid]` | PUT, DELETE | Single payment |
| `/api/members/monthly-fee` | GET, POST | Bulk monthly fee |
| `/api/members/import` | POST | CSV member import |
| `/api/payments` | GET, POST | Global payments (with member join) |
| `/api/payments/import` | POST | Excel payment import |
| `/api/purchases/import` | POST | Excel purchase import |
| `/api/donors` | GET, POST | Donor CRUD |
| `/api/donors/[id]` | GET, PUT, DELETE | Single donor |
| `/api/donors/[id]/donations` | GET, POST | Donor donations |
| `/api/donors/[id]/donations/[did]` | PUT, DELETE | Single donation |
| `/api/collectors` | GET, POST | Collector CRUD |
| `/api/collectors/[id]` | GET, PUT, DELETE | Single collector |
| `/api/invoices` | GET, POST | Invoice/statement CRUD |
| `/api/invoices/[id]` | GET, PUT, DELETE | Single invoice |
| `/api/invoices/generate` | POST | Auto-generate invoices |
| `/api/statements` | GET | Statement data (unified view) |
| `/api/statements/pdf` | GET | Statement HTML for PDF rendering |
| `/api/recurring` | GET, POST | Recurring templates |
| `/api/recurring/[id]` | GET, PUT, DELETE | Single template |
| `/api/recurring/generate` | POST | Generate from templates |
| `/api/reports` | GET | Financial reports |
| `/api/export` | GET | Excel/CSV export |
| `/api/settings` | GET, POST | Settings CRUD |
| `/api/settings/logo` | GET, POST, DELETE | Logo management |
| `/api/admin/migrate` | POST | Run DB migrations |
| `/api/email/send-statement` | POST | Email statement to member |
| `/api/email/payment-confirmation` | POST | Email payment receipt |

### Database tables:
| Table | Key columns | Notes |
|-------|-------------|-------|
| `users` | id, username, password_hash, display_name | Auth users |
| `sessions` | token, user_id, expires_at | Session tokens |
| `categories` | id, name_he, name_en, type, color | Transaction categories |
| `transactions` | id, type, amount, date, category_id, member_id | All transactions (income/expense/purchase) |
| `members` | id, name, phone, email, address, active(INTEGER!) | Members — active is 1/0 not boolean! |
| `member_charges` | id, member_id, description, amount, date | Membership fees / charges |
| `member_payments` | id, member_id, amount, date, method(nullable), reference | Payments received |
| `donors` | id, name, phone, email, active(boolean) | Donors |
| `donor_donations` | id, donor_id, amount, date, collector_id | Donations |
| `collectors` | id, name, phone, email, commission_percent, active(boolean) | Donation collectors |
| `invoices` | id, number, date, member_id, total, status, notes | Invoices/statements |
| `invoice_items` | id, invoice_id, description_he, amount, period | Invoice line items |
| `recurring_transactions` | id, description, amount, type, frequency, active(boolean) | Recurring templates |
| `settings` | key, value, updated_at | Key-value settings store |

---

*End of conversation log. Updated every session.*
