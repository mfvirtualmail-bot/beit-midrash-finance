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

-- v10: Fix purchases stored as 'expense' → should be 'purchase'
-- Purchases are transactions with member_id set, or with a purchase-type category
UPDATE transactions SET type = 'purchase'
WHERE type = 'expense'
  AND (
    member_id IS NOT NULL
    OR category_id IN (SELECT id FROM categories WHERE type = 'purchase')
  );

-- v11: Enable Row Level Security on ALL tables
-- The app uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS,
-- so all API routes continue to work. The public anon key
-- will no longer be able to read/write any data.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE collectors ENABLE ROW LEVEL SECURITY;

-- v12: Add role column to users table for super admin control
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('super_admin', 'user'));
UPDATE users SET role = 'super_admin' WHERE username = 'admin';

-- v13: Label overrides — user-editable renames for parasha/holiday/period names
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

-- v14: Email templates — editable, named templates for statement emails
CREATE TABLE IF NOT EXISTS email_templates (
  id bigint primary key generated always as identity,
  name text not null,
  subject text not null,
  body_html text not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;

-- Seed built-in templates if table is empty
INSERT INTO email_templates (name, subject, body_html, is_default, sort_order)
SELECT 'תבנית חודשית',
  'דף חשבון מעודכן - {{member_name}}',
  '<p>שלום <strong>{{member_name}}</strong>,</p><p>מצורף דף החשבון שלך. יתרה נוכחית: <strong>{{balance}}</strong>.</p><p>הדף המלא מצורף כקובץ PDF.</p>',
  true,
  0
WHERE NOT EXISTS (SELECT 1 FROM email_templates);

INSERT INTO email_templates (name, subject, body_html, is_default, sort_order)
SELECT 'חייב לשעבר',
  'יתרה פתוחה - {{member_name}}',
  '<p>שלום <strong>{{member_name}}</strong>,</p><p>אנו פונים אליך בנוגע ליתרה הפתוחה בחשבונך בסך <strong>{{balance}}</strong>.</p><p>מצורף דף חשבון מפורט. נשמח לקבל את הסדרת החוב בהקדם.</p><p>לבירורים ניתן לפנות אלינו.</p>',
  false,
  1
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'חייב לשעבר');

-- v15: Purchase item templates — pre-filled item lists for Shabbat / Yom Tov
CREATE TABLE IF NOT EXISTS purchase_item_templates (
  id bigint primary key generated always as identity,
  template_key text not null unique,
  label_he text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE purchase_item_templates DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS purchase_item_template_items (
  id bigint primary key generated always as identity,
  template_id bigint not null references purchase_item_templates(id) on delete cascade,
  label_he text not null,
  sort_order int not null default 0
);
ALTER TABLE purchase_item_template_items DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_purchase_item_template_items_template ON purchase_item_template_items(template_id);

-- Seed default Shabbat template + items
INSERT INTO purchase_item_templates (template_key, label_he, sort_order)
SELECT 'shabbat', 'שבת', 0
WHERE NOT EXISTS (SELECT 1 FROM purchase_item_templates WHERE template_key = 'shabbat');

INSERT INTO purchase_item_template_items (template_id, label_he, sort_order)
SELECT t.id, item.label, item.ord
FROM purchase_item_templates t
CROSS JOIN (VALUES
  ('הוצאה והכנסה', 0),
  ('פתיחה', 1),
  ('עליה לתורה - ראשון', 2),
  ('עליה לתורה - שני', 3),
  ('עליה לתורה - שלישי', 4),
  ('עליה לתורה - רביעי', 5),
  ('עליה לתורה - חמישי', 6),
  ('עליה לתורה - שישי', 7),
  ('עליה לתורה - שביעי', 8),
  ('עליה לתורה - מפטיר', 9)
) AS item(label, ord)
WHERE t.template_key = 'shabbat'
  AND NOT EXISTS (SELECT 1 FROM purchase_item_template_items WHERE template_id = t.id);
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
