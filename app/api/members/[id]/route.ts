import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: member } = await supabase.from('members').select('*').eq('id', params.id).single()
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: charges } = await supabase.from('member_charges')
      .select('*, users:created_by(display_name)').eq('member_id', params.id).order('date', { ascending: false })
    const { data: payments } = await supabase.from('member_payments')
      .select('*, users:created_by(display_name)').eq('member_id', params.id).order('date', { ascending: false })
    // Also get purchase/expense transactions linked to this member
    const { data: purchases } = await supabase.from('transactions')
      .select('*, categories(name_he, name_en)')
      .eq('member_id', params.id)
      .in('type', ['expense', 'purchase'])
      .order('date', { ascending: false })

    const tc = (charges ?? []).reduce((s, c) => s + Number(c.amount), 0)
    const purchaseTotal = (purchases ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const tp = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)

    const flatCharges = (charges ?? []).map(c => ({ ...c, created_by_name: (c.users as {display_name:string}|null)?.display_name ?? null, users: undefined }))
    const flatPayments = (payments ?? []).map(p => ({ ...p, created_by_name: (p.users as {display_name:string}|null)?.display_name ?? null, users: undefined }))
    const flatPurchases = (purchases ?? []).map(p => ({
      id: p.id, date: p.date, amount: Number(p.amount), type: p.type,
      description: p.description_he || (p.categories as {name_he:string}|null)?.name_he || '',
      category_name: (p.categories as {name_he:string}|null)?.name_he || '',
      notes: p.notes,
    }))

    return NextResponse.json({
      member: { ...member, total_charges: tc + purchaseTotal, total_payments: tp, balance: tp - tc - purchaseTotal },
      charges: flatCharges, payments: flatPayments, purchases: flatPurchases,
    })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, phone, email, address, notes } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const { data } = await supabase.from('members')
      .update({ name: name.trim(), phone: phone||null, email: email||null, address: address||null, notes: notes||null })
      .eq('id', params.id).select().single()
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabase.from('members').delete().eq('id', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
