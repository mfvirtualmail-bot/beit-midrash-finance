import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name_he, name_en, type, color } = await req.json()
    const resolvedNameEn = name_en || name_he
    const resolvedColor = color || '#6b7280'
    const { data } = await supabase.from('categories')
      .update({ name_he, name_en: resolvedNameEn, type, color: resolvedColor }).eq('id', params.id).select().single()
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('categories').delete().eq('id', params.id)
    return NextResponse.json({ success: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
