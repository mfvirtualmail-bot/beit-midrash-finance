import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    let q = supabase.from('donors').select('*').order('name_he')
    if (search) q = q.or(`name_he.ilike.%${search}%,name_en.ilike.%${search}%,phone.ilike.%${search}%`)
    const { data } = await q
    return NextResponse.json(data ?? [])
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name_he, name_en, phone, email, address, notes, active = true } = body
    if (!name_he) return NextResponse.json({ error: 'name_he required' }, { status: 400 })
    const { data } = await supabase.from('donors')
      .insert({ name_he, name_en: name_en || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null, active })
      .select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
