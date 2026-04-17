import { NextResponse } from 'next/server'

const MIGRATION_SQL = `
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense', 'purchase'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member_id bigint REFERENCES members(id) ON DELETE SET NULL;

-- v3: Collectors
CREATE TABLE IF NOT EXISTS collectors (
  id bigint primary key generated always as identity,
  name text not null,
  phone text,
  email text,
  commission_percent numeric(5,2) not null default 10,
  active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);
ALTER TABLE collectors DISABLE ROW LEVEL SECURITY;
ALTER TABLE donor_donations ADD COLUMN IF NOT EXISTS collector_id bigint REFERENCES collectors(id) ON DELETE SET NULL;

-- v4: Add period column to invoice_items for Date/Period display
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS period text;

-- v5: Allow 'purchase' type in transactions table
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'purchase'));

-- v6: Make payment method nullable (stop defaulting to 'cash')
ALTER TABLE member_payments ALTER COLUMN method DROP NOT NULL;
ALTER TABLE member_payments ALTER COLUMN method DROP DEFAULT;

-- v7: Clean up existing 'cash' defaults — set to NULL where method was auto-filled
-- This converts all existing 'cash' entries to NULL so statements show blank
UPDATE member_payments SET method = NULL WHERE method = 'cash';

-- v8: Set all NULL and 'cash' payment methods to 'unknown'
-- Users who imported payments without specifying method got 'cash' default or NULL
UPDATE member_payments SET method = 'unknown' WHERE method IS NULL OR method = 'cash';

-- v9: Change default from 'cash' to 'unknown' and clean up any remaining 'cash' entries
ALTER TABLE member_payments ALTER COLUMN method SET DEFAULT 'unknown';
UPDATE member_payments SET method = 'unknown' WHERE method = 'cash';

-- v10: Label overrides — user-editable renames for parasha/holiday/period names
CREATE TABLE IF NOT EXISTS label_overrides (
  id bigint primary key generated always as identity,
  original_text text not null unique,
  replacement_text text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE label_overrides DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_label_overrides_original ON label_overrides(original_text);
`

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase config', sql: MIGRATION_SQL }, { status: 500 })
    }

    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

    const res = await fetch(`https://${projectRef}.supabase.co/pg-meta/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-pg-meta-application-name': 'migration',
      },
      body: JSON.stringify({ query: MIGRATION_SQL }),
    })

    const text = await res.text()

    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Migration applied successfully' })
    }

    // If pg-meta is not available, return the SQL for manual execution
    return NextResponse.json({
      error: 'Could not run migration automatically. Please run the SQL manually in your Supabase Dashboard > SQL Editor.',
      sql: MIGRATION_SQL,
      details: text,
    }, { status: 500 })
  } catch (e) {
    return NextResponse.json({
      error: 'Migration failed. Run the SQL manually in Supabase Dashboard > SQL Editor.',
      sql: MIGRATION_SQL,
      details: String(e),
    }, { status: 500 })
  }
}
