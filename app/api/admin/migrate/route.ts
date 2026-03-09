import { NextResponse } from 'next/server'

const MIGRATION_SQL = `
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense', 'purchase'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member_id bigint REFERENCES members(id) ON DELETE SET NULL;
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
