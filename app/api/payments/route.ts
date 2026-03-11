import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const memberId = searchParams.get('member_id') || ''

    // Get all payments with member name joined
    let q = supabase
      .from('member_payments')
      .select('*, members!member_payments_member_id_fkey(name)')
      .order('date', { ascending: false })

    if (memberId) q = q.eq('member_id', Number(memberId))
    if (search) {
      // Search by member name or notes — need to get all and filter client-side
      // since we can't do cross-table ilike easily
    }

    const { data: payments, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also get all members for the dropdown
    const { data: members } = await supabase.from('members').select('id, name').order('name')

    // Format payments with member name
    const result = (payments ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      member_name: (p.members as { name: string } | null)?.name || null,
      members: undefined,
    }))

    // Filter by search if provided
    const filtered = search
      ? result.filter((p: Record<string, unknown>) =>
          (p.member_name as string || '').toLowerCase().includes(search.toLowerCase()) ||
          (p.notes as string || '').toLowerCase().includes(search.toLowerCase()) ||
          (p.reference as string || '').toLowerCase().includes(search.toLowerCase())
        )
      : result

    return NextResponse.json({ payments: filtered, members: members ?? [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    const { member_id, amount, date, method, reference, notes } = await req.json()

    if (!amount || !member_id) {
      return NextResponse.json({ error: 'member_id and amount are required' }, { status: 400 })
    }

    const paymentDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('member_payments')
      .insert({
        member_id: Number(member_id),
        amount: Number(amount),
        date: paymentDate,
        method: method || 'cash',
        reference: reference || null,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
