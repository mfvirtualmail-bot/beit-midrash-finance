import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: collectors } = await supabase
      .from('collectors')
      .select('*')
      .order('name')

    // Get donation totals per collector
    const { data: donations } = await supabase
      .from('donor_donations')
      .select('collector_id, amount')
      .not('collector_id', 'is', null)

    const totals: Record<number, number> = {}
    for (const d of donations ?? []) {
      totals[d.collector_id] = (totals[d.collector_id] ?? 0) + Number(d.amount)
    }

    const result = (collectors ?? []).map(c => ({
      ...c,
      total_collected: totals[c.id] ?? 0,
      total_commission: ((totals[c.id] ?? 0) * Number(c.commission_percent)) / 100,
    }))

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, commission_percent, notes, active = true } = await req.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const { data } = await supabase
      .from('collectors')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        commission_percent: commission_percent ?? 10,
        active,
        notes: notes || null,
      })
      .select()
      .single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
