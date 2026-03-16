import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendStatementEmail } from '@/lib/email'
import { formatHebrewDate, toHDate, MONTH_HE, yearToGematriya, getHebrewPeriodSortIndex, getPaymentSortIndex } from '@/lib/hebrewDate'
import { generateStatementPage, wrapStatementHtml, getStatementSettings } from '@/lib/statementHtml'
import type { StatementLine } from '@/lib/statementHtml'

// POST /api/email/send-statement
// Content-Type: multipart/form-data
// Fields: member_id (required), date_from, date_to, pdf (File - optional PDF attachment)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const memberId = formData.get('member_id') as string
    const dateFrom = formData.get('date_from') as string | null
    const dateTo = formData.get('date_to') as string | null
    const pdfFile = formData.get('pdf') as File | null

    if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

    // Get member
    const { data: member } = await supabase
      .from('members')
      .select('id, name, phone, email, address')
      .eq('id', Number(memberId))
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!member.email) return NextResponse.json({ error: 'Member has no email address' }, { status: 400 })

    const methodLabels: Record<string, string> = {
      cash: 'מזומן', bank: 'העברה בנקאית', check: "צ'ק", credit_card: 'כרטיס אשראי',
    }

    // Charges
    let chargesQ = supabase.from('member_charges').select('id, description, amount, date, notes')
      .eq('member_id', Number(memberId)).order('date', { ascending: true })
    if (dateFrom) chargesQ = chargesQ.gte('date', dateFrom)
    if (dateTo) chargesQ = chargesQ.lte('date', dateTo)
    const { data: charges } = await chargesQ

    // Purchases
    let purchasesQ = supabase.from('transactions')
      .select('id, amount, description_he, date, notes, categories(name_he)')
      .eq('member_id', Number(memberId)).in('type', ['expense', 'purchase']).order('date', { ascending: true })
    if (dateFrom) purchasesQ = purchasesQ.gte('date', dateFrom)
    if (dateTo) purchasesQ = purchasesQ.lte('date', dateTo)
    const { data: purchases } = await purchasesQ

    // Payments
    let paymentsQ = supabase.from('member_payments').select('id, amount, date, method, reference, notes')
      .eq('member_id', Number(memberId)).order('date', { ascending: true })
    if (dateFrom) paymentsQ = paymentsQ.gte('date', dateFrom)
    if (dateTo) paymentsQ = paymentsQ.lte('date', dateTo)
    const { data: payments } = await paymentsQ

    // Build lines
    const lines: Array<{ date: string; period: string; description: string; charge: number; payment: number; lineType: string }> = []

    for (const c of charges ?? []) {
      let period = ''
      const feeMatch = c.description?.match(/דמי חבר\s*-\s*(.+)/)
      if (feeMatch) { period = feeMatch[1] }
      else {
        try {
          const hd = toHDate(c.date)
          period = `${MONTH_HE[hd.getMonth()] ?? ''} ${yearToGematriya(hd.getFullYear())}`
        } catch { period = formatHebrewDate(c.date, 'he') }
      }
      lines.push({ date: c.date, period, description: 'דמי חבר', charge: Number(c.amount), payment: 0, lineType: 'membership' })
    }

    for (const p of purchases ?? []) {
      const pDate = (p as Record<string, unknown>).date as string
      const rawDesc = (p as Record<string, unknown>).description_he as string || ''
      const categoryName = ((p as Record<string, unknown>).categories as { name_he: string } | null)?.name_he || ''
      let period = '', itemName = ''
      const dashIndex = rawDesc.indexOf(' - ')
      if (dashIndex > 0) { period = rawDesc.substring(0, dashIndex).trim(); itemName = rawDesc.substring(dashIndex + 3).trim() }
      else if (rawDesc) { period = rawDesc; itemName = categoryName || 'רכישה' }
      else { period = categoryName || 'רכישה'; itemName = categoryName || 'רכישה' }
      lines.push({ date: pDate, period, description: itemName, charge: Number((p as Record<string, unknown>).amount), payment: 0, lineType: 'purchase' })
    }

    for (const pay of payments ?? []) {
      const ml = (pay.method && pay.method !== 'unknown') ? (methodLabels[pay.method] || pay.method) : ''
      const desc = ml ? `תשלום - ${ml}${pay.reference ? ` (${pay.reference})` : ''}` : `תשלום${pay.reference ? ` (${pay.reference})` : ''}`
      lines.push({ date: pay.date, period: formatHebrewDate(pay.date, 'he'), description: desc, charge: 0, payment: Number(pay.amount), lineType: 'payment' })
    }

    lines.sort((a, b) => {
      const idxA = a.lineType === 'payment' ? getPaymentSortIndex(a.date) : getHebrewPeriodSortIndex(a.period)
      const idxB = b.lineType === 'payment' ? getPaymentSortIndex(b.date) : getHebrewPeriodSortIndex(b.period)
      if (idxA !== idxB) return idxA - idxB
      return a.date.localeCompare(b.date)
    })

    const totalCharged = lines.reduce((s, l) => s + l.charge, 0)
    const totalPaid = lines.reduce((s, l) => s + l.payment, 0)
    const balance = totalCharged - totalPaid

    // Prepare PDF attachment
    let pdfBuffer: Buffer
    let pdfFileName = `דף_חשבון_${member.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`

    if (pdfFile) {
      // Client sent a generated PDF
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
      pdfFileName = pdfFileName.replace('.html', '.pdf')
    } else {
      // Generate statement HTML inline (no external fetch — avoids Vercel auth issues)
      const stmtSettings = await getStatementSettings()
      const stmtLines: StatementLine[] = lines.map(l => ({
        date: l.date,
        period: l.period,
        description: l.description,
        charge: l.charge,
        payment: l.payment,
        lineType: l.lineType as StatementLine['lineType'],
      }))
      const page = generateStatementPage({ name: member.name, address: member.address }, stmtLines, stmtSettings)
      const htmlContent = wrapStatementHtml([page])
      pdfBuffer = Buffer.from(htmlContent, 'utf-8')
    }

    await sendStatementEmail(
      member.email,
      member.name,
      totalCharged,
      totalPaid,
      balance,
      lines,
      pdfBuffer,
      pdfFileName,
    )

    return NextResponse.json({ ok: true, message: 'Email sent successfully' })
  } catch (e) {
    console.error('Send statement email error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
