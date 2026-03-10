import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data } = await supabase.from('collectors').select('*').eq('id', params.id).single()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { name, phone, email, commission_percent, notes, active } = body
    const { data } = await supabase
      .from('collectors')
      .update({
        name,
        phone: phone || null,
        email: email || null,
        commission_percent: commission_percent ?? 10,
        active,
        notes: notes || null,
      })
      .eq('id', params.id)
      .select()
      .single()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('collectors').delete().eq('id', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
