import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    let q = supabase.from('invoices')
      .select('*, members(name), donors(name_he)')
      .order('date', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data } = await q
    // Flatten and compute totals
    const ids = (data ?? []).map((inv: { id: number }) => inv.id)
    let itemsMap: Record<number, { amount: number }[]> = {}
    if (ids.length > 0) {
      const { data: items } = await supabase.from('invoice_items').select('invoice_id, amount').in('invoice_id', ids)
      for (const item of items ?? []) {
        const inv_id = (item as { invoice_id: number; amount: number }).invoice_id
        if (!itemsMap[inv_id]) itemsMap[inv_id] = []
        itemsMap[inv_id].push(item as { amount: number })
      }
    }
    const result = (data ?? []).map((inv: Record<string, unknown>) => ({
      ...inv,
      member_name: (inv.members as { name: string } | null)?.name ?? null,
      donor_name_he: (inv.donors as { name_he: string } | null)?.name_he ?? null,
      members: undefined,
      donors: undefined,
      total: (itemsMap[inv.id as number] ?? []).reduce((s, i) => s + Number(i.amount), 0),
    }))
    return NextResponse.json(result)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { number, date, due_date, member_id, donor_id, title_he, title_en, status, notes, items } = await req.json()
    if (!date || !title_he) return NextResponse.json({ error: 'date and title_he required' }, { status: 400 })
    const { data: inv } = await supabase.from('invoices')
      .insert({ number: number || null, date, due_date: due_date || null, member_id: member_id || null, donor_id: donor_id || null, title_he, title_en: title_en || null, status: status || 'draft', notes: notes || null })
      .select().single()
    if (items && items.length > 0) {
      const rows = items.map((it: { description_he: string; description_en?: string; quantity?: number; unit_price?: number; amount: number }) => ({
        invoice_id: (inv as { id: number }).id,
        description_he: it.description_he,
        description_en: it.description_en || null,
        quantity: it.quantity || 1,
        unit_price: it.unit_price || it.amount,
        amount: it.amount,
      }))
      await supabase.from('invoice_items').insert(rows)
    }
    return NextResponse.json(inv, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
