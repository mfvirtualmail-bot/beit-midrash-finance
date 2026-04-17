import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { original_text, replacement_text, notes } = await req.json()
    if (!original_text || !replacement_text) {
      return NextResponse.json({ error: 'original_text and replacement_text required' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('label_overrides')
      .update({
        original_text: original_text.trim(),
        replacement_text: replacement_text.trim(),
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('label_overrides').delete().eq('id', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
