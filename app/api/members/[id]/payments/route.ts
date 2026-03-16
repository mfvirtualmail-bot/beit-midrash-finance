import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    const { amount, date, method, reference, notes } = await req.json()
    if (!amount || !date) return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
    const { data } = await supabase.from('member_payments')
      .insert({ member_id: Number(params.id), amount: Number(amount), date, method: method || 'unknown', reference: reference||null, notes: notes||null, created_by: userId })
      .select().single()
    return NextResponse.json(data, { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
