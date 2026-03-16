import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatHebrewDate, toHDate, MONTH_HE, yearToGematriya, getHebrewPeriodSortIndex, getPaymentSortIndex } from '@/lib/hebrewDate'
import { generateStatementPage, wrapStatementHtml, getStatementSettings } from '@/lib/statementHtml'
import type { StatementLine } from '@/lib/statementHtml'

// GET /api/statements/pdf?member_ids=1,2,3&date_from=...&date_to=...
// Returns clean HTML optimized for A4 PDF rendering (used by client-side PDF generator)
// No browser print dialog — client handles PDF generation via html2canvas + jsPDF
export async function GET(req: NextRequest) {
  const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
  const dateFrom = req.nextUrl.searchParams.get('date_from')
  const dateTo = req.nextUrl.searchParams.get('date_to')

  if (!memberIdsParam) {
    return NextResponse.json({ error: 'member_ids required' }, { status: 400 })
  }

  const memberIds = memberIdsParam.split(',').map(Number)

  // Get org settings
  const stmtSettings = await getStatementSettings()

  const methodLabels: Record<string, string> = {
    cash: 'מזומן',
    bank: 'העברה בנקאית',
    check: "צ'ק",
    credit_card: 'כרטיס אשראי',
  }

  // Get members
  const { data: members } = await supabase
    .from('members')
    .select('id, name, phone, email, address')
    .in('id', memberIds)

  if (!members || members.length === 0) {
    return new NextResponse('<html><body><p>No members found</p></body></html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Build statement pages
  const pages: string[] = []

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

    // Get purchases
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

    // Build lines with proper period/description per type
    const lines: StatementLine[] = []

    // Memberships: period = Hebrew month+year, description = "דמי חבר"
    for (const c of charges ?? []) {
      let period = ''
      const feeMatch = c.description?.match(/דמי חבר\s*-\s*(.+)/)
      if (feeMatch) {
        period = feeMatch[1]
      } else {
        try {
          const hd = toHDate(c.date)
          const monthName = MONTH_HE[hd.getMonth()] ?? ''
          const yearStr = yearToGematriya(hd.getFullYear())
          period = `${monthName} ${yearStr}`
        } catch {
          period = formatHebrewDate(c.date, 'he')
        }
      }
      lines.push({ date: c.date, period, description: 'דמי חבר', charge: Number(c.amount), payment: 0 })
    }

    // Purchases: split description_he on " - " to get period and item name
    for (const p of purchases ?? []) {
      const pDate = (p as Record<string, unknown>).date as string
      const rawDesc = (p as Record<string, unknown>).description_he as string || ''
      const categoryName = ((p as Record<string, unknown>).categories as { name_he: string } | null)?.name_he || ''

      let period = ''
      let itemName = ''

      const dashIndex = rawDesc.indexOf(' - ')
      if (dashIndex > 0) {
        period = rawDesc.substring(0, dashIndex).trim()
        itemName = rawDesc.substring(dashIndex + 3).trim()
      } else if (rawDesc) {
        period = rawDesc
        itemName = categoryName || 'רכישה'
      } else {
        period = categoryName || 'רכישה'
        itemName = categoryName || 'רכישה'
      }

      lines.push({ date: pDate, period, description: itemName, charge: Number((p as Record<string, unknown>).amount), payment: 0 })
    }

    // Payments: period = Hebrew date, description = "תשלום - method"
    for (const pay of payments ?? []) {
      const methodLabel = (pay.method && pay.method !== 'unknown') ? (methodLabels[pay.method] || pay.method) : ''
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
        lineType: 'payment' as const,
      })
    }

    // Sort by Hebrew calendar order (Tishrei → Elul)
    lines.sort((a, b) => {
      const idxA = a.lineType === 'payment' ? getPaymentSortIndex(a.date) : getHebrewPeriodSortIndex(a.period)
      const idxB = b.lineType === 'payment' ? getPaymentSortIndex(b.date) : getHebrewPeriodSortIndex(b.period)
      if (idxA !== idxB) return idxA - idxB
      return a.date.localeCompare(b.date)
    })

    pages.push(generateStatementPage({ name: member.name, address: member.address }, lines, stmtSettings))
  }

  const html = wrapStatementHtml(pages)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
