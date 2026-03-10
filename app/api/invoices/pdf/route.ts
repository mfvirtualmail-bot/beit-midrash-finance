import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatHebrewDate } from '@/lib/hebrewDate'

// GET /api/invoices/pdf?id=123 — returns an HTML page optimized for PDF saving
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get member name if linked
  let memberName = ''
  if (invoice.member_id) {
    const { data: member } = await supabase.from('members').select('name').eq('id', invoice.member_id).single()
    memberName = member?.name ?? ''
  }

  // Get settings (key-value rows)
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

  const items = invoice.items ?? []
  const total = items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
  const hebrewDate = formatHebrewDate(invoice.date, 'he')
  const statusMap: Record<string, string> = { draft: 'טיוטה', sent: 'נשלח', paid: 'שולם', cancelled: 'בוטל' }

  const fmt = (n: number) => `€${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const itemRows = items.map((item: { description_he: string; amount: number }, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:10px 16px;font-size:13px">${item.description_he || ''}</td>
      <td style="padding:10px 16px;font-size:13px;text-align:left;font-weight:600">${fmt(Number(item.amount))}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>חשבונית ${invoice.number || '#' + invoice.id}</title>
<style>
  @page { size: A4; margin: 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Arial', sans-serif;
    direction: rtl;
    color: #1f2937;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .container { max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { border-bottom: 4px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .org-info { }
  .org-name { font-size: 22px; font-weight: bold; color: #2563eb; display: flex; align-items: center; gap: 8px; }
  .org-logo { width: 60px; height: 60px; object-fit: contain; }
  .org-details { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .inv-label { font-size: 28px; font-weight: bold; color: #1f2937; text-align: left; }
  .inv-number { font-size: 13px; color: #6b7280; font-family: monospace; text-align: left; }
  .status { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  .status-draft { background: #f3f4f6; color: #4b5563; }
  .status-sent { background: #dbeafe; color: #1d4ed8; }
  .status-paid { background: #dcfce7; color: #15803d; }
  .status-cancelled { background: #fee2e2; color: #dc2626; }
  .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .date-box { background: #f9fafb; border-radius: 8px; padding: 12px; }
  .date-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
  .date-value { font-size: 14px; font-weight: 600; }
  .hebrew-date { font-size: 11px; color: #9ca3af; }
  .recipient { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
  .recipient-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; }
  .recipient-name { font-size: 16px; font-weight: bold; }
  .title-section { border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px; }
  .invoice-title { font-size: 18px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  table thead tr { background: #2563eb !important; color: white; }
  table thead th { padding: 10px 16px; font-size: 13px; font-weight: 600; }
  table thead th:first-child { text-align: right; border-radius: 0 8px 0 0; }
  table thead th:last-child { text-align: left; border-radius: 8px 0 0 0; }
  table tfoot tr { background: #2563eb !important; color: white; }
  table tfoot td { padding: 10px 16px; font-weight: bold; }
  table tfoot td:first-child { text-align: left; border-radius: 0 0 8px 0; }
  table tfoot td:last-child { text-align: left; font-size: 18px; border-radius: 0 0 0 8px; }
  .notes { background: #f9fafb; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 13px; color: #4b5563; }
  .notes-label { font-weight: 600; color: #374151; margin-bottom: 4px; }
  .footer { border-top: 2px solid #e5e7eb; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #6b7280; text-align: center; }
  @media print {
    body { padding: 0; }
    .container { padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="container">
  <!-- Print/Download buttons -->
  <div class="no-print" style="margin-bottom:20px;text-align:center">
    <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">
      הורד / הדפס PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="org-info">
      <div class="org-name">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" class="org-logo" />` : ''}
        ${orgName}
      </div>
      ${orgAddress ? `<div class="org-details">${orgAddress}</div>` : ''}
      ${orgPhone || orgEmail ? `<div class="org-details">${orgPhone}${orgPhone && orgEmail ? '  |  ' : ''}${orgEmail}</div>` : ''}
      ${headerText ? `<div style="font-size:12px;color:#4b5563;margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px;white-space:pre-line">${headerText}</div>` : ''}
    </div>
    <div style="text-align:left">
      <div class="inv-label">חשבונית</div>
      <div class="inv-number">${invoice.number || '#' + invoice.id}</div>
      <div class="status status-${invoice.status}">${statusMap[invoice.status] ?? invoice.status}</div>
    </div>
  </div>

  <!-- Dates -->
  <div class="dates">
    <div class="date-box">
      <div class="date-label">תאריך חשבונית</div>
      <div class="date-value">${invoice.date}</div>
      <div class="hebrew-date">${hebrewDate}</div>
    </div>
    ${invoice.due_date ? `
    <div class="date-box" style="background:#fffbeb">
      <div class="date-label" style="color:#d97706">תאריך פירעון</div>
      <div class="date-value">${invoice.due_date}</div>
      <div class="hebrew-date">${formatHebrewDate(invoice.due_date, 'he')}</div>
    </div>` : ''}
  </div>

  <!-- Recipient -->
  ${memberName ? `
  <div class="recipient">
    <div class="recipient-label">נמען</div>
    <div class="recipient-name">${memberName}</div>
  </div>` : ''}

  <!-- Title -->
  <div class="title-section">
    <div class="invoice-title">${invoice.title_he || ''}</div>
    ${invoice.title_en && invoice.title_en !== invoice.title_he ? `<div style="color:#6b7280;font-size:14px">${invoice.title_en}</div>` : ''}
  </div>

  <!-- Items -->
  ${items.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th style="text-align:right">תיאור</th>
        <th style="text-align:left">סכום</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td style="text-align:left">סה"כ</td>
        <td style="text-align:left;font-size:18px">${fmt(invoice.total ?? total)}</td>
      </tr>
    </tfoot>
  </table>` : ''}

  <!-- Notes -->
  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-label">הערות</div>
    <div style="white-space:pre-line">${invoice.notes}</div>
  </div>` : ''}

  <!-- Footer -->
  ${footerText || orgPhone || orgEmail ? `
  <div class="footer">
    ${footerText ? `<div style="white-space:pre-line">${footerText}</div>` : ''}
    ${!footerText && (orgPhone || orgEmail) ? `<div>${orgPhone}${orgPhone && orgEmail ? '  |  ' : ''}${orgEmail}</div>` : ''}
  </div>` : ''}
</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
