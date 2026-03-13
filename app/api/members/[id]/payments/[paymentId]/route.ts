import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  try {
    const { amount, date, method, reference, notes } = await req.json()
    const updates: Record<string, unknown> = {}
    if (amount !== undefined) updates.amount = Number(amount)
    if (date !== undefined) updates.date = date
    if (method !== undefined) updates.method = method || null
    if (reference !== undefined) updates.reference = reference || null
    if (notes !== undefined) updates.notes = notes || null

    const { data, error } = await supabase
      .from('member_payments')
      .update(updates)
      .eq('id', params.paymentId)
      .eq('member_id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  try {
    await supabase.from('member_payments').delete().eq('id', params.paymentId).eq('member_id', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
