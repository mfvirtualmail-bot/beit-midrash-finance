import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data } = await supabase.from('recurring_transactions')
      .select('*, categories(name_he, name_en, color)')
      .order('name_he')
    const result = (data ?? []).map((r: Record<string, unknown>) => {
      const cat = r.categories as { name_he: string; name_en: string; color: string } | null
      return { ...r, categories: undefined, category_name_he: cat?.name_he, category_name_en: cat?.name_en, category_color: cat?.color }
    })
    return NextResponse.json(result)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name_he, name_en, type, amount, category_id, frequency, day_of_month, hebrew_day, hebrew_month, start_date, end_date, notes, active = true } = body
    if (!name_he || !type || !amount || !frequency || !start_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const { data } = await supabase.from('recurring_transactions')
      .insert({ name_he, name_en: name_en || null, type, amount, category_id: category_id || null, frequency, day_of_month: day_of_month || null, hebrew_day: hebrew_day || null, hebrew_month: hebrew_month || null, start_date, end_date: end_date || null, notes: notes || null, active })
      .select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
