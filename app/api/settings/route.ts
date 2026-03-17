import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const DEFAULT_PAYMENT_METHODS = JSON.stringify([
  { value: 'cash', label_he: 'מזומן', label_en: 'Cash' },
  { value: 'check', label_he: 'צ׳ק', label_en: 'Check' },
  { value: 'bank_transfer', label_he: 'העברה בנקאית', label_en: 'Bank Transfer' },
  { value: 'credit_card', label_he: 'כרטיס אשראי', label_en: 'Credit Card' },
])

const DEFAULTS: Record<string, string> = {
  org_name_he: 'בית המדרש',
  org_name_en: 'Beit Midrash',
  org_address: '',
  org_phone: '',
  org_email: '',
  invoice_header_he: '',
  invoice_header_en: '',
  invoice_footer_he: '',
  invoice_footer_en: '',
  statement_header_html: '',
  statement_footer_html: '',
  resend_api_key: '',
  email_sender: '',
  payment_methods: DEFAULT_PAYMENT_METHODS,
}

// Keys that should be stored/returned as raw JSON (not stringified again)
const JSON_KEYS = new Set(['payment_methods'])

export async function GET() {
  try {
    const { data } = await supabase.from('settings').select('key, value')
    const result: Record<string, unknown> = { ...DEFAULTS }
    for (const row of data ?? []) {
      if (JSON_KEYS.has(row.key)) {
        try { result[row.key] = JSON.parse(row.value ?? '[]') } catch { result[row.key] = row.value ?? '' }
      } else {
        result[row.key] = row.value ?? ''
      }
    }
    // Also parse default JSON values
    Array.from(JSON_KEYS).forEach(key => {
      if (typeof result[key] === 'string') {
        try { result[key] = JSON.parse(result[key] as string) } catch { /* keep as string */ }
      }
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const upserts = Object.entries(body)
      .filter(([key]) => key in DEFAULTS)
      .map(([key, value]) => ({
        key,
        value: JSON_KEYS.has(key) ? (typeof value === 'string' ? value : JSON.stringify(value)) : String(value ?? ''),
        updated_at: new Date().toISOString(),
      }))

    if (upserts.length === 0) return NextResponse.json({ ok: true })

    const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
