import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const [{ data: donor }, { data: donations }] = await Promise.all([
      supabase.from('donors').select('*').eq('id', id).single(),
      supabase.from('donor_donations').select('*').eq('donor_id', id).order('date', { ascending: false }),
    ])
    if (!donor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const total_donated = (donations ?? []).reduce((s: number, d: { amount: number }) => s + Number(d.amount), 0)
    return NextResponse.json({ ...donor, donations: donations ?? [], total_donated })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const { name_he, name_en, phone, email, address, notes, active } = await req.json()
    const { data } = await supabase.from('donors')
      .update({ name_he, name_en: name_en || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null, active })
      .eq('id', id).select().single()
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('donors').delete().eq('id', parseInt(params.id))
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
