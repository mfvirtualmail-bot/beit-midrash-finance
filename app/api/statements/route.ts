import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatHebrewDate } from '@/lib/hebrewDate'

// GET /api/statements?member_id=1 or ?member_ids=1,2,3
// Returns unified financial data: charges, payments, purchases, balance per member
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id')
    const memberIdsParam = searchParams.get('member_ids')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let memberIds: number[] = []
    if (memberId) memberIds = [Number(memberId)]
    else if (memberIdsParam) memberIds = memberIdsParam.split(',').map(Number)
    else {
      return NextResponse.json({ error: 'member_id or member_ids required' }, { status: 400 })
    }

    // Get member info
    const { data: members } = await supabase
      .from('members')
      .select('id, name, phone, email, address')
      .in('id', memberIds)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No members found' }, { status: 404 })
    }

    const results = []

    for (const member of members) {
      // Get charges
      let chargesQ = supabase
        .from('member_charges')
        .select('id, description, amount, date, notes')
        .eq('member_id', member.id)
        .order('date', { ascending: true })
      if (dateFrom) chargesQ = chargesQ.gte('date', dateFrom)
      if (dateTo) chargesQ = chargesQ.lte('date', dateTo)
      const { data: charges } = await chargesQ

      // Get purchase transactions for this member
      let purchasesQ = supabase
        .from('transactions')
        .select('id, amount, description_he, date, notes, categories(name_he)')
        .eq('member_id', member.id)
        .in('type', ['expense', 'purchase'])
        .order('date', { ascending: true })
      if (dateFrom) purchasesQ = purchasesQ.gte('date', dateFrom)
      if (dateTo) purchasesQ = purchasesQ.lte('date', dateTo)
      const { data: purchases } = await purchasesQ

      // Get payments
      let paymentsQ = supabase
        .from('member_payments')
        .select('id, amount, date, method, reference, notes')
        .eq('member_id', member.id)
        .order('date', { ascending: true })
      if (dateFrom) paymentsQ = paymentsQ.gte('date', dateFrom)
      if (dateTo) paymentsQ = paymentsQ.lte('date', dateTo)
      const { data: payments } = await paymentsQ

      // Build unified line items sorted by date
      const lines: Array<{
        date: string
        hebrewDate: string
        description: string
        charge: number
        payment: number
      }> = []

      for (const c of charges ?? []) {
        lines.push({
          date: c.date,
          hebrewDate: formatHebrewDate(c.date, 'he'),
          description: c.description,
          charge: Number(c.amount),
          payment: 0,
        })
      }

      for (const p of purchases ?? []) {
        const pDate = (p as Record<string, unknown>).date as string
        const desc = (p as Record<string, unknown>).description_he as string ||
          ((p as Record<string, unknown>).categories as { name_he: string } | null)?.name_he || 'רכישה'
        lines.push({
          date: pDate,
          hebrewDate: formatHebrewDate(pDate, 'he'),
          description: desc,
          charge: Number((p as Record<string, unknown>).amount),
          payment: 0,
        })
      }

      const methodLabels: Record<string, string> = {
        cash: 'מזומן',
        bank: 'העברה בנקאית',
        check: "צ'ק",
        credit_card: 'כרטיס אשראי',
      }

      for (const pay of payments ?? []) {
        const methodLabel = methodLabels[pay.method] || pay.method
        lines.push({
          date: pay.date,
          hebrewDate: formatHebrewDate(pay.date, 'he'),
          description: `תשלום - ${methodLabel}${pay.reference ? ` (${pay.reference})` : ''}`,
          charge: 0,
          payment: Number(pay.amount),
        })
      }

      // Sort chronologically by date (follows Hebrew calendar order naturally)
      lines.sort((a, b) => a.date.localeCompare(b.date))

      const totalCharged = lines.reduce((s, l) => s + l.charge, 0)
      const totalPaid = lines.reduce((s, l) => s + l.payment, 0)
      const remainingBalance = totalCharged - totalPaid

      results.push({
        member,
        lines,
        totalCharged,
        totalPaid,
        remainingBalance,
      })
    }

    // Return single member or array
    if (memberId && results.length === 1) {
      return NextResponse.json(results[0])
    }
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
