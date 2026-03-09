import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function flattenTx(t: Record<string, unknown>) {
  const cat = t.categories as Record<string, string> | null
  return { ...t, categories: undefined,
    category_name_he: cat?.name_he ?? null,
    category_name_en: cat?.name_en ?? null,
    category_color: cat?.color ?? null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')

    let q = supabase.from('transactions').select('*, categories(name_he, name_en, color)')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)

    if (type) q = q.eq('type', type)
    if (category) q = q.eq('category_id', parseInt(category))
    if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`)
    if (year) q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    if (search) q = q.or(`description_he.ilike.%${search}%,description_en.ilike.%${search}%,notes.ilike.%${search}%`)

    const { data } = await q
    return NextResponse.json((data ?? []).map(flattenTx))
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { type, amount, description_he, description_en, category_id, date, notes, member_id } = await req.json()
    if (!type || !amount || !date) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    const { data } = await supabase.from('transactions')
      .insert({ type, amount, description_he: description_he||null, description_en: description_en||null,
        category_id: category_id||null, date, notes: notes||null, member_id: member_id||null })
      .select('*, categories(name_he, name_en, color)').single()
    return NextResponse.json(flattenTx(data as Record<string, unknown>), { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
