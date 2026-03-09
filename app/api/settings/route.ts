import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
}

export async function GET() {
  try {
    const { data } = await supabase.from('settings').select('key, value')
    const result = { ...DEFAULTS }
    for (const row of data ?? []) {
      result[row.key] = row.value ?? ''
    }
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
      .map(([key, value]) => ({ key, value: String(value ?? ''), updated_at: new Date().toISOString() }))

    if (upserts.length === 0) return NextResponse.json({ ok: true })

    const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
