# admin.wilrijk — Tuition Management System (שכר לימוד)

## Project Context

**Repo:** mfvirtualmail-bot/admin.wilrijk (GitHub)
**Purpose:** Tuition fee management for a school/institution (מוסד). Replaces Excel-based tracking.
**Critical UX requirement:** A 93-year-old gabbai currently manages tuition via a large Excel sheet. The system MUST include a spreadsheet-like interface (AG Grid) so he can continue working the same way.
**Currency:** Euro (EUR / €)
**Deployed on:** Vercel (with preview deployments on branches, production on `main`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18, Tailwind CSS, AG Grid Community (spreadsheet) |
| Database | Supabase (PostgreSQL) |
| Auth | Custom cookie-based sessions (like beit-midrash-finance) |
| Charts | Recharts |
| Hosting | Vercel |

---

## Languages (i18n)

Three languages, **per-user setting** (not a global toggle):

| Language | Code | Direction |
|---|---|---|
| Dutch | `nl` | LTR |
| English | `en` | LTR |
| Yiddish | `yi` | RTL |

- Each user has a `language` field in the DB
- Language loads automatically on login
- User can change language in their profile/settings
- All UI strings in all 3 languages

---

## Permission System (No Fixed Roles)

The **Super Admin** creates users and defines exactly what each user can do via a checkbox matrix:

| Module | Actions |
|---|---|
| families | view, add, edit, delete |
| children | view, add, edit, delete |
| charges | view, add, edit, delete |
| payments | view, add, edit, delete |
| spreadsheet | view, edit |
| reports | view |
| users | view, add, edit, delete |
| settings | view, edit |

---

## Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| username | text | unique, NOT NULL |
| password_hash | text | PBKDF2/SHA-512 |
| display_name | text | |
| language | text | 'nl', 'en', or 'yi' — default 'nl' |
| is_super_admin | boolean | default false |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### sessions
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| token | text | unique session token |
| expires_at | timestamptz | |
| created_at | timestamptz | |

### user_permissions
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| module | text | e.g. 'families', 'payments' |
| action | text | e.g. 'view', 'add', 'edit', 'delete' |
| created_at | timestamptz | |

### families
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL — family/parent name |
| phone | text | |
| email | text | |
| address | text | |
| notes | text | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### children
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK → families |
| name | text | NOT NULL — child name |
| class | text | grade/class name |
| tuition_amount | numeric(10,2) | monthly tuition per child |
| active | boolean | default true |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### charges
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| child_id | uuid | FK → children |
| family_id | uuid | FK → families (denormalized for fast queries) |
| amount | numeric(10,2) | |
| month | integer | 1-12 |
| year | integer | e.g. 2026 |
| description | text | |
| created_at | timestamptz | |

### payments
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK → families |
| amount | numeric(10,2) | |
| date | date | payment date |
| method | text | nullable — cash, bank, check, etc. |
| notes | text | |
| created_at | timestamptz | |

### settings
| Column | Type | Notes |
|---|---|---|
| key | text | PK |
| value | text | |

### audit_log
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| action | text | 'create', 'update', 'delete' |
| module | text | 'families', 'payments', etc. |
| record_id | uuid | which record was affected |
| old_data | jsonb | previous values |
| new_data | jsonb | new values |
| created_at | timestamptz | |

---

## Pages / Routes

| Route | Description |
|---|---|
| `/login` | Login page |
| `/` | Dashboard — summary cards, recent payments |
| `/spreadsheet` | **THE main page** — Excel-like tuition grid (AG Grid) |
| `/families` | Family list |
| `/families/[id]` | Family detail — children, charges, payments |
| `/children` | All children list |
| `/payments` | All payments list |
| `/reports` | Charts — monthly, by family, by class |
| `/admin/users` | User management (super admin only) |
| `/admin/users/[id]` | Permission matrix per user |
| `/settings` | App config |
| `/profile` | User profile + language preference |

---

## Spreadsheet Interface (Critical Feature)

Using **AG Grid Community** (free):

```
| Family  | Child  | Sep 25 | Oct 25 | Nov 25 | ... | Total | Paid | Balance |
|---------|--------|--------|--------|--------|-----|-------|------|---------|
| Cohen   | Moshe  | 200    | 200    | 200    |     | 600   | 400  | -200    |
| Cohen   | Sarah  | 150    | 150    |        |     | 300   |      |         |
| COHEN TOTAL                                       | 900   | 400  | -500    |
| Levy    | David  | 200    | 200    | 200    |     | 600   | 600  |    0    |
```

Features:
- Click a cell → type a number → Tab to next cell — exactly like Excel
- Rows grouped by family with subtotals
- Color coding: red = unpaid, green = paid, yellow = partial
- Large font for readability (the 93-year-old gabbai)
- Auto-saves each cell change
- Built-in Excel export button

---

## Build Phases

| Phase | What | Priority |
|---|---|---|
| 0 | Project setup, auth, layout, deploy empty shell | Foundation |
| 1 | User management + permission system | Security |
| 2 | Families, children, charges, payments CRUD | Core data |
| 3 | Spreadsheet interface (AG Grid) | #1 UX priority |
| 4 | Full i18n (Dutch, English, Yiddish) | Usability |
| 5 | Dashboard, reports, Excel export | Analytics |
| 6 | Settings, audit log, bulk import, polish | Finish |

---

## Previous Conversation Status

- User was about to share zoomed-in screenshots of the existing Excel sheet
- The Excel sheet shows how the 93-year-old gabbai currently tracks tuition
- Need to see: column headers, data structure, how months/amounts/payments are organized
- This will inform the exact layout of the AG Grid spreadsheet page

---

## Notes

- Payments are **per family**, not per child. A family with 3 children makes one payment.
- Charges are **per child** but balance rolls up to the family.
- The system replaces a manual Excel sheet — must be intuitive for non-technical users.
- Preview deployments via Vercel branches (no PRs needed during development).
