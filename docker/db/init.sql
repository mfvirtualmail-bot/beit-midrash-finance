-- ============================================================
-- Beit Midrash Finance — Database Initialization
-- This runs automatically on first Docker startup
-- ============================================================

-- ─── PostgreSQL Roles for PostgREST ──────────────────────────
-- PostgREST uses these roles to control access
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT service_role TO authenticator;

-- ─── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name_he text NOT NULL,
  name_en text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'purchase')),
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'purchase')),
  amount numeric(12,2) NOT NULL,
  description_he text,
  description_en text,
  category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
  member_id bigint,
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS members (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  active integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);

-- Add member_id FK to transactions (after members table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transactions_member_id_fkey'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_member_id_fkey
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS member_charges (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  member_id bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS member_payments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  member_id bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  method text,
  reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS donors (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name_he text NOT NULL,
  name_en text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donor_donations (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  donor_id bigint NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  description text,
  collector_id bigint,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  number text,
  date date NOT NULL,
  due_date date,
  member_id bigint REFERENCES members(id) ON DELETE SET NULL,
  donor_id bigint REFERENCES donors(id) ON DELETE SET NULL,
  title_he text NOT NULL,
  title_en text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  invoice_id bigint NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description_he text NOT NULL,
  description_en text,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL,
  period text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name_he text NOT NULL,
  name_en text,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric(12,2) NOT NULL,
  category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly', 'hebrew_monthly')),
  day_of_month integer,
  hebrew_day integer,
  hebrew_month integer,
  start_date date NOT NULL,
  end_date date,
  last_generated date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collectors (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  phone text,
  email text,
  commission_percent numeric(5,2) NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add collector FK to donor_donations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'donor_donations_collector_id_fkey'
  ) THEN
    ALTER TABLE donor_donations
      ADD CONSTRAINT donor_donations_collector_id_fkey
      FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_donor_donations_donor ON donor_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(active);
CREATE INDEX IF NOT EXISTS idx_member_charges_member ON member_charges(member_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_member ON member_payments(member_id);

-- ─── Disable RLS (we use service_role key) ───────────────────

ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_charges DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE donors DISABLE ROW LEVEL SECURITY;
ALTER TABLE donor_donations DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE collectors DISABLE ROW LEVEL SECURITY;

-- ─── Grant service_role full access ──────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Ensure future tables also get grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- ─── Default settings ────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  ('org_name', ''),
  ('currency', '₪'),
  ('statement_header_html', ''),
  ('statement_footer_html', ''),
  ('payment_methods', '[{"value":"cash","label_he":"מזומן","label_en":"Cash"},{"value":"check","label_he":"צ׳ק","label_en":"Check"},{"value":"bank_transfer","label_he":"העברה בנקאית","label_en":"Bank Transfer"},{"value":"credit_card","label_he":"כרטיס אשראי","label_en":"Credit Card"}]')
ON CONFLICT (key) DO NOTHING;
