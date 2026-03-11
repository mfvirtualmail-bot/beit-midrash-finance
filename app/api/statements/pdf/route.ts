import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatHebrewDate, toHDate, MONTH_HE, yearToGematriya, getHebrewPeriodSortIndex, getPaymentSortIndex } from '@/lib/hebrewDate'

// GET /api/statements/pdf?member_ids=1,2,3&date_from=...&date_to=...
// Returns an HTML page optimized for A4 PDF output
// With &download=1, returns Content-Disposition: attachment to trigger direct download
export async function GET(req: NextRequest) {
  const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
  const dateFrom = req.nextUrl.searchParams.get('date_from')
  const dateTo = req.nextUrl.searchParams.get('date_to')
  const download = req.nextUrl.searchParams.get('download')

  if (!memberIdsParam) {
    return NextResponse.json({ error: 'member_ids required' }, { status: 400 })
  }

  const memberIds = memberIdsParam.split(',').map(Number)

  // Get org settings
  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value ?? ''
  const orgName = settings.org_name_he || 'בית המדרש'
  const orgAddress = settings.org_address || ''
  const orgPhone = settings.org_phone || ''
  const orgEmail = settings.org_email || ''
  const headerText = settings.invoice_header_he || ''
  const footerText = settings.invoice_footer_he || ''
  const logoDataUrl = settings.org_logo || ''

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

  const fmt = (n: number) => `€${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const todayStr = new Date().toISOString().split('T')[0]

  const methodLabels: Record<string, string> = {
    cash: 'מזומן',
    bank: 'העברה בנקאית',
    check: "צ'ק",
    credit_card: 'כרטיס אשראי',
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
    const lines: Array<{ date: string; period: string; description: string; charge: number; payment: number; lineType?: 'membership' | 'purchase' | 'payment' }> = []

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
    // e.g. "פרשת שמות - שלש סעודות" → period="פרשת שמות", description="שלש סעודות"
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
      const methodLabel = methodLabels[pay.method] || pay.method
      const hebrewDate = formatHebrewDate(pay.date, 'he')
      lines.push({
        date: pay.date,
        period: hebrewDate,
        description: `תשלום - ${methodLabel}${pay.reference ? ` (${pay.reference})` : ''}`,
        charge: 0,
        payment: Number(pay.amount),
        lineType: 'payment' as const,
      })
    }

    // Sort by Hebrew calendar order (Tishrei → Elul)
    lines.sort((a, b) => {
      const idxA = (a as { lineType?: string }).lineType === 'payment' ? getPaymentSortIndex(a.date) : getHebrewPeriodSortIndex(a.period)
      const idxB = (b as { lineType?: string }).lineType === 'payment' ? getPaymentSortIndex(b.date) : getHebrewPeriodSortIndex(b.period)
      if (idxA !== idxB) return idxA - idxB
      return a.date.localeCompare(b.date)
    })

    const totalCharged = lines.reduce((s, l) => s + l.charge, 0)
    const totalPaid = lines.reduce((s, l) => s + l.payment, 0)
    const remainingBalance = totalCharged - totalPaid

    // Build rows HTML
    const rowsHtml = lines.map((line, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:4px 10px;font-size:10px;color:#4b5563">${line.period}</td>
        <td style="padding:4px 10px;font-size:11px;font-weight:500">${line.description}</td>
        <td style="padding:4px 10px;font-size:11px;text-align:left;color:#dc2626;font-weight:500">${line.charge > 0 ? fmt(line.charge) : ''}</td>
        <td style="padding:4px 10px;font-size:11px;text-align:left;color:#15803d;font-weight:500">${line.payment > 0 ? fmt(line.payment) : ''}</td>
      </tr>
    `).join('')

    pages.push(`
      <div class="statement-page">
        <!-- Header -->
        <div class="header">
          <div>
            <div class="org-name">
              ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" class="org-logo" />` : ''}
              ${orgName}
            </div>
            ${orgAddress ? `<div class="org-details">${orgAddress}</div>` : ''}
            ${orgPhone || orgEmail ? `<div class="org-details">${orgPhone}${orgPhone && orgEmail ? '  |  ' : ''}${orgEmail}</div>` : ''}
            ${headerText ? `<div style="font-size:10px;color:#4b5563;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px;white-space:pre-line">${headerText}</div>` : ''}
          </div>
          <div style="text-align:left">
            <div class="inv-label">דף חשבון</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">${todayStr}</div>
          </div>
        </div>

        <!-- Recipient -->
        <div class="meta-row">
          <div>
            <div style="color:#6b7280;font-size:10px">לכבוד</div>
            <div class="recipient">${member.name}</div>
            ${member.address ? `<div style="font-size:10px;color:#6b7280">${member.address}</div>` : ''}
          </div>
        </div>

        <!-- Items table: 4 columns -->
        ${lines.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th style="text-align:right;width:22%">תקופה / שבוע</th>
              <th style="text-align:right;width:38%">פריט / תיאור</th>
              <th style="text-align:left;width:20%">חיוב (€)</th>
              <th style="text-align:left;width:20%">תשלום (€)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="subtotal-row">
              <td style="padding:6px 10px" colspan="2"><strong>סה"כ</strong></td>
              <td style="padding:6px 10px;text-align:left;font-weight:bold;color:#dc2626">${fmt(totalCharged)}</td>
              <td style="padding:6px 10px;text-align:left;font-weight:bold;color:#15803d">${fmt(totalPaid)}</td>
            </tr>
            <tr class="balance-row">
              <td style="padding:8px 10px" colspan="2"><strong style="font-size:14px">יתרת חוב</strong></td>
              <td style="padding:8px 10px;text-align:left;font-size:16px;font-weight:bold" colspan="2">
                ${remainingBalance > 0 ? fmt(remainingBalance) : remainingBalance < 0 ? `זיכוי ${fmt(Math.abs(remainingBalance))}` : '€0.00'}
              </td>
            </tr>
          </tfoot>
        </table>` : '<p style="text-align:center;color:#9ca3af;padding:20px">אין נתונים לתקופה זו</p>'}

        ${footerText || orgPhone || orgEmail ? `
        <div class="footer">
          ${footerText ? `<div style="white-space:pre-line">${footerText}</div>` : ''}
          ${!footerText && (orgPhone || orgEmail) ? `<div>${orgPhone}${orgPhone && orgEmail ? '  |  ' : ''}${orgEmail}</div>` : ''}
        </div>` : ''}
      </div>
    `)
  }

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>דפי חשבון</title>
<style>
  @page { size: A4; margin: 10mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Arial', sans-serif;
    direction: rtl;
    color: #1f2937;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .statement-page {
    max-width: 700px;
    margin: 0 auto;
    padding: 15px;
    page-break-after: always;
  }
  .statement-page:last-child { page-break-after: auto; }
  .header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .org-name { font-size: 18px; font-weight: bold; color: #2563eb; display: flex; align-items: center; gap: 6px; }
  .org-logo { width: 50px; height: 50px; object-fit: contain; }
  .org-details { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .inv-label { font-size: 22px; font-weight: bold; color: #1f2937; text-align: left; }
  .meta-row { margin-bottom: 12px; font-size: 12px; }
  .meta-row .recipient { font-weight: bold; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
  table thead tr { background: #2563eb !important; color: white; }
  table thead th { padding: 6px 10px; font-size: 11px; font-weight: 600; }
  table thead th:first-child { border-radius: 0 4px 0 0; }
  table thead th:last-child { border-radius: 4px 0 0 0; }
  .subtotal-row { background: #f3f4f6; border-top: 2px solid #d1d5db; }
  .balance-row { background: #2563eb !important; color: white; }
  .balance-row td { color: white !important; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 16px; font-size: 10px; color: #6b7280; text-align: center; }
  @media print {
    body { padding: 0; }
    .statement-page { padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
  @media screen {
    .statement-page { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; }
  }
</style>
<script>
// Auto-trigger print dialog for direct PDF download
window.addEventListener('load', function() {
  if (window.location.search.includes('download=1')) {
    setTimeout(function() { window.print(); }, 500);
  }
});
</script>
</head>
<body>
<div class="no-print" style="text-align:center;padding:15px;background:#f3f4f6">
  <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">
    הורד / הדפס PDF
  </button>
  <span style="margin:0 10px;color:#6b7280">${members.length} ${members.length === 1 ? 'דף חשבון' : 'דפי חשבון'}</span>
</div>
${pages.join('\n')}
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
