import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const donor_id = parseInt(params.id)
    const { amount, date, description, notes, collector_id } = await req.json()
    if (!amount || !date) return NextResponse.json({ error: 'amount and date required' }, { status: 400 })
    const { data } = await supabase.from('donor_donations')
      .insert({ donor_id, amount, date, description: description || null, notes: notes || null, collector_id: collector_id ? Number(collector_id) : null })
      .select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
