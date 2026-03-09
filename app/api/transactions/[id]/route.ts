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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { type, amount, description_he, description_en, category_id, date, notes } = await req.json()
    const { data } = await supabase.from('transactions')
      .update({ type, amount, description_he: description_he||null, description_en: description_en||null,
        category_id: category_id||null, date, notes: notes||null })
      .eq('id', params.id).select('*, categories(name_he, name_en, color)').single()
    return NextResponse.json(flattenTx(data as Record<string, unknown>))
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('transactions').delete().eq('id', params.id)
    return NextResponse.json({ success: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
