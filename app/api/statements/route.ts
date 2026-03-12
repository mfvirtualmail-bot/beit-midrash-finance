import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatHebrewDate, toHDate, MONTH_HE, yearToGematriya, getHebrewPeriodSortIndex, getPaymentSortIndex } from '@/lib/hebrewDate'

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

    const methodLabels: Record<string, string> = {
      cash: 'מזומן',
      bank: 'העברה בנקאית',
      check: "צ'ק",
      credit_card: 'כרטיס אשראי',
    }

    const results = []

    for (const member of members) {
      // Get charges (memberships)
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
      // Each line has: lineType to distinguish membership/purchase/payment
      // period: formatted period string for column 1
      // description: formatted item description for column 2
      const lines: Array<{
        date: string
        period: string
        description: string
        charge: number
        payment: number
        lineType: 'membership' | 'purchase' | 'payment'
      }> = []

      // Memberships: period = Hebrew month+year, description = "דמי חבר"
      for (const c of charges ?? []) {
        // Extract Hebrew month/year from the charge description if it follows "דמי חבר - MONTH YEAR" pattern
        let period = ''
        const feeMatch = c.description?.match(/דמי חבר\s*-\s*(.+)/)
        if (feeMatch) {
          period = feeMatch[1] // e.g. "תשרי תשפ״ו"
        } else {
          // Fallback: convert date to Hebrew month+year
          try {
            const hd = toHDate(c.date)
            const monthName = MONTH_HE[hd.getMonth()] ?? ''
            const yearStr = yearToGematriya(hd.getFullYear())
            period = `${monthName} ${yearStr}`
          } catch {
            period = formatHebrewDate(c.date, 'he')
          }
        }
        lines.push({
          date: c.date,
          period,
          description: 'דמי חבר',
          charge: Number(c.amount),
          payment: 0,
          lineType: 'membership',
        })
      }

      // Purchases: split description_he on " - " to get period and item name
      // e.g. "פרשת שמות - שלש סעודות" → period="פרשת שמות", description="שלש סעודות"
      // e.g. "יום כיפור - מפטיר יונה" → period="יום כיפור", description="מפטיר יונה"
      for (const p of purchases ?? []) {
        const pDate = (p as Record<string, unknown>).date as string
        const rawDesc = (p as Record<string, unknown>).description_he as string || ''
        const categoryName = ((p as Record<string, unknown>).categories as { name_he: string } | null)?.name_he || ''

        let period = ''
        let itemName = ''

        // Split on " - " to separate period from item name
        const dashIndex = rawDesc.indexOf(' - ')
        if (dashIndex > 0) {
          period = rawDesc.substring(0, dashIndex).trim()
          itemName = rawDesc.substring(dashIndex + 3).trim()
        } else if (rawDesc) {
          // No dash separator — use category as item, rawDesc as period
          period = rawDesc
          itemName = categoryName || 'רכישה'
        } else {
          // No description at all — use category name
          period = categoryName || 'רכישה'
          itemName = categoryName || 'רכישה'
        }

        lines.push({
          date: pDate,
          period,
          description: itemName,
          charge: Number((p as Record<string, unknown>).amount),
          payment: 0,
          lineType: 'purchase',
        })
      }

      // Payments: period = Hebrew date, description = "תשלום - method"
      for (const pay of payments ?? []) {
        const methodLabel = pay.method ? (methodLabels[pay.method] || pay.method) : ''
        const hebrewDate = formatHebrewDate(pay.date, 'he')
        const desc = methodLabel
          ? `תשלום - ${methodLabel}${pay.reference ? ` (${pay.reference})` : ''}`
          : `תשלום${pay.reference ? ` (${pay.reference})` : ''}`
        lines.push({
          date: pay.date,
          period: hebrewDate,
          description: desc,
          charge: 0,
          payment: Number(pay.amount),
          lineType: 'payment',
        })
      }

      // Sort by Hebrew calendar order (Tishrei → Elul), not by Gregorian date
      lines.sort((a, b) => {
        const idxA = a.lineType === 'payment' ? getPaymentSortIndex(a.date) : getHebrewPeriodSortIndex(a.period)
        const idxB = b.lineType === 'payment' ? getPaymentSortIndex(b.date) : getHebrewPeriodSortIndex(b.period)
        if (idxA !== idxB) return idxA - idxB
        // Same index: sub-sort by Gregorian date
        return a.date.localeCompare(b.date)
      })

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
