import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const [{ data: inv }, { data: items }] = await Promise.all([
      supabase.from('invoices').select('*, members(name), donors(name_he)').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('id'),
    ])
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const total = (items ?? []).reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
    return NextResponse.json({
      ...inv,
      member_name: (inv as Record<string, unknown> & { members?: { name: string } | null }).members?.name ?? null,
      donor_name_he: (inv as Record<string, unknown> & { donors?: { name_he: string } | null }).donors?.name_he ?? null,
      members: undefined,
      donors: undefined,
      items: items ?? [],
      total,
    })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const { number, date, due_date, member_id, donor_id, title_he, title_en, status, notes, items } = await req.json()
    await supabase.from('invoices')
      .update({ number: number || null, date, due_date: due_date || null, member_id: member_id || null, donor_id: donor_id || null, title_he, title_en: title_en || null, status, notes: notes || null })
      .eq('id', id)
    if (items !== undefined) {
      await supabase.from('invoice_items').delete().eq('invoice_id', id)
      if (items.length > 0) {
        const rows = items.map((it: { description_he: string; description_en?: string; quantity?: number; unit_price?: number; amount: number }) => ({
          invoice_id: id,
          description_he: it.description_he,
          description_en: it.description_en || null,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || it.amount,
          amount: it.amount,
        }))
        await supabase.from('invoice_items').insert(rows)
      }
    }
    const { data } = await supabase.from('invoices').select('*').eq('id', id).single()
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    await supabase.from('invoices').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
