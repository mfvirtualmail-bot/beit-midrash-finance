import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    let q = supabase.from('members').select('*').order('name')
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    const { data: members } = await q

    const { data: charges } = await supabase.from('member_charges').select('member_id, amount')
    const { data: payments } = await supabase.from('member_payments').select('member_id, amount')

    const result = (members ?? []).map(m => {
      const tc = (charges ?? []).filter(c => c.member_id === m.id).reduce((s, c) => s + Number(c.amount), 0)
      const tp = (payments ?? []).filter(p => p.member_id === m.id).reduce((s, p) => s + Number(p.amount), 0)
      return { ...m, total_charges: tc, total_payments: tp, balance: tp - tc }
    })
    return NextResponse.json(result)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    const { name, phone, email, address, notes } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const { data } = await supabase.from('members')
      .insert({ name: name.trim(), phone: phone||null, email: email||null, address: address||null, notes: notes||null, created_by: userId })
      .select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
