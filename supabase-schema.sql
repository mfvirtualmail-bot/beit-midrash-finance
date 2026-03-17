-- ============================================================
-- Beit Midrash Finance - Complete Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- EXISTING TABLES (if not already created):

create table if not exists categories (
  id bigint primary key generated always as identity,
  name_he text not null,
  name_en text not null,
  type text not null check (type in ('income', 'expense', 'purchase')),
  color text not null default '#6b7280',
  created_at timestamptz default now()
);

create table if not exists users (
  id bigint primary key generated always as identity,
  username text unique not null,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz default now()
);

create table if not exists sessions (
  token text primary key,
  user_id bigint references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id bigint primary key generated always as identity,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null,
  description_he text,
  description_en text,
  category_id bigint references categories(id) on delete set null,
  date date not null,
  notes text,
  created_at timestamptz default now(),
  created_by bigint references users(id) on delete set null
);

create table if not exists members (
  id bigint primary key generated always as identity,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  active integer not null default 1,
  created_at timestamptz default now(),
  created_by bigint references users(id) on delete set null
);

create table if not exists member_charges (
  id bigint primary key generated always as identity,
  member_id bigint not null references members(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null,
  date date not null,
  notes text,
  created_at timestamptz default now(),
  created_by bigint references users(id) on delete set null
);

create table if not exists member_payments (
  id bigint primary key generated always as identity,
  member_id bigint not null references members(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  method text default 'unknown',
  reference text,
  notes text,
  created_at timestamptz default now(),
  created_by bigint references users(id) on delete set null
);

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Donors
create table if not exists donors (
  id bigint primary key generated always as identity,
  name_he text not null,
  name_en text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Donor donations (separate from transactions for donor tracking)
create table if not exists donor_donations (
  id bigint primary key generated always as identity,
  donor_id bigint not null references donors(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  description text,
  notes text,
  created_at timestamptz default now()
);

-- Invoices
create table if not exists invoices (
  id bigint primary key generated always as identity,
  number text,
  date date not null,
  due_date date,
  member_id bigint references members(id) on delete set null,
  donor_id bigint references donors(id) on delete set null,
  title_he text not null,
  title_en text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  created_by bigint references users(id) on delete set null
);

-- Invoice line items
create table if not exists invoice_items (
  id bigint primary key generated always as identity,
  invoice_id bigint not null references invoices(id) on delete cascade,
  description_he text not null,
  description_en text,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null,
  created_at timestamptz default now()
);

-- Recurring transactions
create table if not exists recurring_transactions (
  id bigint primary key generated always as identity,
  name_he text not null,
  name_en text,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null,
  category_id bigint references categories(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly', 'hebrew_monthly')),
  day_of_month integer,         -- day 1-31 for monthly/yearly
  hebrew_day integer,           -- day 1-30 for hebrew_monthly / yearly hebrew
  hebrew_month integer,         -- Hebcal month number for yearly
  start_date date not null,
  end_date date,
  last_generated date,
  active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

-- Organization settings (key-value store for invoice header/footer, org details, etc.)
create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table settings disable row level security;

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_type on transactions(type);
create index if not exists idx_donor_donations_donor on donor_donations(donor_id);
create index if not exists idx_invoice_items_invoice on invoice_items(invoice_id);
create index if not exists idx_recurring_active on recurring_transactions(active);

-- ============================================================
-- Row Level Security (RLS) - disable for service role key usage
-- ============================================================
alter table donors disable row level security;
alter table donor_donations disable row level security;
alter table invoices disable row level security;
alter table invoice_items disable row level security;
alter table recurring_transactions disable row level security;

-- If you see "permission denied" errors, also run:
-- grant all on all tables in schema public to service_role;
-- grant all on all sequences in schema public to service_role;

-- ============================================================
-- MIGRATIONS (run these if upgrading an existing installation)
-- ============================================================

-- v2: Add 'purchase' type for member purchase categories
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense', 'purchase'));

-- v2: Add member_id to transactions for purchase tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member_id bigint REFERENCES members(id) ON DELETE SET NULL;

-- v3: Collectors (agents) who collect donations and take a commission percentage
create table if not exists collectors (
  id bigint primary key generated always as identity,
  name text not null,
  phone text,
  email text,
  commission_percent numeric(5,2) not null default 10,
  active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

alter table collectors disable row level security;

-- v3: Add collector_id to donor_donations
ALTER TABLE donor_donations ADD COLUMN IF NOT EXISTS collector_id bigint REFERENCES collectors(id) ON DELETE SET NULL;
