import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const body = await req.json()
    const { name_he, name_en, type, amount, category_id, frequency, day_of_month, hebrew_day, hebrew_month, start_date, end_date, notes, active } = body
    const { data } = await supabase.from('recurring_transactions')
      .update({ name_he, name_en: name_en || null, type, amount, category_id: category_id || null, frequency, day_of_month: day_of_month || null, hebrew_day: hebrew_day || null, hebrew_month: hebrew_month || null, start_date, end_date: end_date || null, notes: notes || null, active })
      .eq('id', id).select().single()
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('recurring_transactions').delete().eq('id', parseInt(params.id))
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
