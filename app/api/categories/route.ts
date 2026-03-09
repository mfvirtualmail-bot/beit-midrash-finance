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
    if (!name_he || !name_en || !type || !color) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const { data } = await supabase.from('categories').insert({ name_he, name_en, type, color }).select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
