import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data } = await supabase.from('categories').select('*').order('type').order('name_en')
    return NextResponse.json(data ?? [])
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { name_he, name_en, type, color } = await req.json()
    if (!name_he || !type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const resolvedColor = color || '#6b7280'
    const resolvedNameEn = name_en || name_he
    const { data } = await supabase.from('categories').insert({ name_he, name_en: resolvedNameEn, type, color: resolvedColor }).select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
