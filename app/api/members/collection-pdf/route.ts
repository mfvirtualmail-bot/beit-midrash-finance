import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { htmlToPdf } from '@/lib/htmlToPdf'
import { loadOrgSettings } from '@/lib/statementPdf'

interface CollectionRow {
  name: string
  owed: number
}

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format')

  const [{ data: members }, { data: charges }, { data: payments }, { data: purchases }] = await Promise.all([
    supabase.from('members').select('id, name').order('name'),
    supabase.from('member_charges').select('member_id, amount'),
    supabase.from('member_payments').select('member_id, amount'),
    supabase.from('transactions').select('member_id, amount').not('member_id', 'is', null).eq('type', 'purchase'),
  ])

  const chargesByMember = new Map<number, number>()
  for (const c of charges ?? []) chargesByMember.set(c.member_id, (chargesByMember.get(c.member_id) || 0) + Number(c.amount))
  for (const p of purchases ?? []) chargesByMember.set(p.member_id, (chargesByMember.get(p.member_id) || 0) + Number(p.amount))

  const paymentsByMember = new Map<number, number>()
  for (const p of payments ?? []) paymentsByMember.set(p.member_id, (paymentsByMember.get(p.member_id) || 0) + Number(p.amount))

  const rows: CollectionRow[] = (members ?? [])
    .map(m => ({
      name: m.name as string,
      owed: (chargesByMember.get(m.id) || 0) - (paymentsByMember.get(m.id) || 0),
    }))
    .filter(r => r.owed > 0.005)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0)
  const org = await loadOrgSettings()
  const html = generateCollectionHtml(rows, totalOwed, org)

  if (format === 'html') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const pdfBuffer = await htmlToPdf(html)
  const filename = `רשימת_גבייה_${new Date().toISOString().split('T')[0]}.pdf`
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}

function generateCollectionHtml(
  rows: CollectionRow[],
  totalOwed: number,
  org: { orgName: string; orgAddress: string; orgPhone: string; orgEmail: string; logoDataUrl: string },
): string {
  const fmt = (n: number) => `€${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const todayStr = new Date().toISOString().split('T')[0]

  const rowsHtml = rows.map((r, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="cell-num">${i + 1}</td>
      <td class="cell-name">${escapeHtml(r.name)}</td>
      <td class="cell-owed">${fmt(r.owed)}</td>
      <td class="cell-collected"></td>
      <td class="cell-notes"></td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>רשימת גבייה</title>
<style>
  @page { size: A4; margin: 12mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Arial', 'Helvetica Neue', sans-serif;
    direction: rtl;
    color: #1e293b;
    line-height: 1.4;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header-block {
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%);
    color: white;
    padding: 16px 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 8px;
    margin-bottom: 14px;
  }
  .header-right { display: flex; align-items: center; gap: 14px; }
  .org-logo {
    width: 52px; height: 52px; object-fit: contain;
    border-radius: 8px;
    background: rgba(255,255,255,0.15);
    padding: 4px;
  }
  .org-name { font-size: 17px; font-weight: 700; letter-spacing: 0.3px; }
  .org-sub { font-size: 10px; color: rgba(255,255,255,0.8); margin-top: 2px; }
  .header-left { text-align: left; }
  .doc-title { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .doc-date { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 3px; }

  table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
  thead tr { background: #f1f5f9; }
  thead th {
    padding: 10px 8px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    text-align: right;
    border: 1px solid #cbd5e1;
  }
  thead th.th-amount { text-align: left; }
  tbody td {
    padding: 10px 8px;
    font-size: 12px;
    border: 1px solid #cbd5e1;
    height: 28px;
  }
  .row-even { background: #ffffff; }
  .row-odd  { background: #f8fafc; }
  tbody tr { page-break-inside: avoid; }

  .cell-num      { width: 6%;  text-align: center; color: #64748b; font-weight: 500; }
  .cell-name     { width: 32%; font-weight: 600; color: #0f172a; }
  .cell-owed     { width: 18%; text-align: left; color: #dc2626; font-weight: 700; }
  .cell-collected{ width: 18%; }
  .cell-notes    { width: 26%; }

  tfoot td {
    padding: 12px 10px;
    font-size: 13px;
    font-weight: 800;
    background: #1e40af;
    color: white;
    border: 1px solid #1e40af;
  }
  .tfoot-label { text-align: right; }
  .tfoot-amount { text-align: left; }

  .empty-block {
    padding: 40px;
    text-align: center;
    color: #94a3b8;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
  }
  .summary-line {
    margin-top: 10px;
    font-size: 11px;
    color: #64748b;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header-block">
    <div class="header-right">
      ${org.logoDataUrl ? `<img src="${org.logoDataUrl}" alt="Logo" class="org-logo" />` : ''}
      <div>
        <div class="org-name">${escapeHtml(org.orgName)}</div>
        ${org.orgAddress ? `<div class="org-sub">${escapeHtml(org.orgAddress)}</div>` : ''}
      </div>
    </div>
    <div class="header-left">
      <div class="doc-title">רשימת גבייה</div>
      <div class="doc-date">${todayStr}</div>
    </div>
  </div>

  ${rows.length === 0 ? `
    <div class="empty-block">אין חברים עם יתרת חוב</div>
  ` : `
  <table>
    <thead>
      <tr>
        <th class="cell-num">#</th>
        <th class="cell-name">שם</th>
        <th class="cell-owed th-amount">חוב (€)</th>
        <th class="cell-collected">סכום שנגבה</th>
        <th class="cell-notes">הערות</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" class="tfoot-label">סה"כ חוב (${rows.length} חברים)</td>
        <td class="tfoot-amount">${fmt(totalOwed)}</td>
        <td></td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  <div class="summary-line">הופק בתאריך ${todayStr}</div>
  `}
</body>
</html>`
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const maxDuration = 30
export const dynamic = 'force-dynamic'
