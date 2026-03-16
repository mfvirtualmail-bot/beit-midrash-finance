import { supabase } from './supabase'

export interface StatementLine {
  date: string
  period: string
  description: string
  charge: number
  payment: number
  lineType?: 'membership' | 'purchase' | 'payment'
}

export interface StatementMember {
  name: string
  address?: string | null
}

export interface StatementSettings {
  orgName: string
  orgAddress: string
  orgPhone: string
  orgEmail: string
  headerHtml: string
  footerHtml: string
  invoiceHeaderHe: string
  invoiceFooterHe: string
  logoDataUrl: string
}

export async function getStatementSettings(): Promise<StatementSettings> {
  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value ?? ''
  return {
    orgName: settings.org_name_he || 'בית המדרש',
    orgAddress: settings.org_address || '',
    orgPhone: settings.org_phone || '',
    orgEmail: settings.org_email || '',
    headerHtml: settings.statement_header_html || '',
    footerHtml: settings.statement_footer_html || '',
    invoiceHeaderHe: settings.invoice_header_he || '',
    invoiceFooterHe: settings.invoice_footer_he || '',
    logoDataUrl: settings.org_logo || '',
  }
}

const fmt = (n: number) => `€${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function generateStatementPage(
  member: StatementMember,
  lines: StatementLine[],
  s: StatementSettings,
): string {
  const todayStr = new Date().toISOString().split('T')[0]
  const headerText = s.headerHtml || s.invoiceHeaderHe || ''
  const footerText = s.footerHtml || s.invoiceFooterHe || ''
  const isRichHeader = !!s.headerHtml
  const isRichFooter = !!s.footerHtml

  const totalCharged = lines.reduce((sum, l) => sum + l.charge, 0)
  const totalPaid = lines.reduce((sum, l) => sum + l.payment, 0)
  const remainingBalance = totalCharged - totalPaid

  const rowsHtml = lines.map((line, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="cell-period">${line.period}</td>
      <td class="cell-desc">${line.description}</td>
      <td class="cell-charge">${line.charge > 0 ? fmt(line.charge) : ''}</td>
      <td class="cell-payment">${line.payment > 0 ? fmt(line.payment) : ''}</td>
    </tr>
  `).join('')

  return `
    <div class="statement-page">
      <!-- Header block -->
      <div class="header-block">
        <div class="header-right">
          ${s.logoDataUrl ? `<img src="${s.logoDataUrl}" alt="Logo" class="org-logo" />` : ''}
          <div>
            <div class="org-name">${s.orgName}</div>
            ${s.orgAddress ? `<div class="org-sub">${s.orgAddress}</div>` : ''}
            ${s.orgPhone || s.orgEmail ? `<div class="org-sub">${[s.orgPhone, s.orgEmail].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
        </div>
        <div class="header-left">
          <div class="doc-title">דף חשבון</div>
          <div class="doc-date">${todayStr}</div>
        </div>
      </div>

      ${headerText ? `<div class="${isRichHeader ? 'rich-header' : 'header-note'}">${headerText}</div>` : ''}

      <!-- Recipient block -->
      <div class="recipient-block">
        <div class="recipient-label">לכבוד</div>
        <div class="recipient-name">${member.name}</div>
        ${member.address ? `<div class="recipient-address">${member.address}</div>` : ''}
      </div>

      <!-- Items table block -->
      ${lines.length > 0 ? `
      <div class="table-block">
        <table>
          <thead>
            <tr>
              <th style="width:22%">תקופה / שבוע</th>
              <th style="width:38%">פריט / תיאור</th>
              <th class="th-amount" style="width:20%">חיוב (€)</th>
              <th class="th-amount" style="width:20%">תשלום (€)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Totals block -->
      <div class="totals-block">
        <div class="total-row">
          <span class="total-label">סה"כ חיובים</span>
          <span class="total-charge">${fmt(totalCharged)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">סה"כ תשלומים</span>
          <span class="total-payment">${fmt(totalPaid)}</span>
        </div>
      </div>

      <!-- Balance block -->
      <div class="balance-block ${remainingBalance <= 0 ? 'balance-paid' : ''}">
        <span class="balance-label">יתרת חוב</span>
        <span class="balance-amount">${remainingBalance > 0 ? fmt(remainingBalance) : remainingBalance < 0 ? `זיכוי ${fmt(Math.abs(remainingBalance))}` : '€0.00'}</span>
      </div>` : '<div class="empty-block">אין נתונים לתקופה זו</div>'}

      <!-- Footer block -->
      ${footerText || s.orgPhone || s.orgEmail ? `
      <div class="${isRichFooter ? 'rich-footer' : 'footer-block'}">
        ${footerText ? `<div>${footerText}</div>` : ''}
        ${!footerText && (s.orgPhone || s.orgEmail) ? `<div class="footer-block">${[s.orgPhone, s.orgEmail].filter(Boolean).join(' · ')}</div>` : ''}
      </div>` : ''}
    </div>
  `
}

export function wrapStatementHtml(pages: string[]): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>דפי חשבון</title>
<style>
  @page { size: A4; margin: 12mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Arial', 'Helvetica Neue', sans-serif;
    direction: rtl;
    color: #1e293b;
    line-height: 1.5;
    background: #f8fafc;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .statement-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 0;
    page-break-after: always;
    background: #fff;
  }
  .statement-page:last-child { page-break-after: auto; }

  /* Header block */
  .header-block {
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%);
    color: white;
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 8px 8px 0 0;
  }
  .header-right { display: flex; align-items: center; gap: 14px; }
  .org-logo {
    width: 56px; height: 56px; object-fit: contain;
    border-radius: 8px;
    background: rgba(255,255,255,0.15);
    padding: 4px;
  }
  .org-name { font-size: 17px; font-weight: 700; letter-spacing: 0.3px; }
  .org-sub { font-size: 10px; color: rgba(255,255,255,0.8); margin-top: 2px; }
  .header-left { text-align: left; }
  .doc-title { font-size: 24px; font-weight: 800; letter-spacing: 1px; }
  .doc-date { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 3px; }
  .header-note {
    background: #eff6ff;
    border-right: 4px solid #2563eb;
    padding: 8px 16px;
    font-size: 10px;
    color: #1e40af;
    white-space: pre-line;
  }

  /* Recipient block */
  .recipient-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin: 16px 20px 12px;
    padding: 14px 18px;
  }
  .recipient-label { font-size: 10px; color: #94a3b8; font-weight: 500; margin-bottom: 2px; }
  .recipient-name { font-size: 16px; font-weight: 700; color: #0f172a; }
  .recipient-address { font-size: 11px; color: #64748b; margin-top: 3px; }

  /* Table block */
  .table-block {
    margin: 0 20px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; }
  table thead tr { background: #f1f5f9; }
  table thead th {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    text-align: right;
    border-bottom: 2px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  table thead th.th-amount { text-align: left; }
  .row-even { background: #ffffff; page-break-inside: avoid; }
  .row-odd { background: #f8fafc; page-break-inside: avoid; }
  .row-even:hover, .row-odd:hover { background: #f1f5f9; }
  .cell-period { padding: 8px 14px; font-size: 11px; color: #64748b; font-weight: 500; }
  .cell-desc { padding: 8px 14px; font-size: 12px; font-weight: 600; color: #1e293b; }
  .cell-charge { padding: 8px 14px; font-size: 12px; text-align: left; color: #dc2626; font-weight: 600; }
  .cell-payment { padding: 8px 14px; font-size: 12px; text-align: left; color: #16a34a; font-weight: 600; }

  /* Totals block */
  .totals-block {
    margin: 12px 20px 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 18px;
    border-bottom: 1px solid #e2e8f0;
  }
  .total-row:last-child { border-bottom: none; }
  .total-label { font-size: 12px; font-weight: 600; color: #475569; }
  .total-charge { font-size: 14px; font-weight: 700; color: #dc2626; }
  .total-payment { font-size: 14px; font-weight: 700; color: #16a34a; }

  /* Balance block */
  .balance-block {
    margin: 12px 20px 0;
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
    border-radius: 8px;
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    page-break-inside: avoid;
  }
  .balance-block.balance-paid {
    background: linear-gradient(135deg, #15803d 0%, #16a34a 100%);
  }
  .balance-label { font-size: 16px; font-weight: 700; }
  .balance-amount { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }

  /* Empty block */
  .empty-block {
    margin: 20px;
    padding: 30px;
    text-align: center;
    color: #94a3b8;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
  }

  /* Footer block */
  .footer-block {
    margin: 16px 20px 0;
    padding: 12px 18px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 10px;
    color: #64748b;
    text-align: center;
    white-space: pre-line;
    page-break-inside: avoid;
  }

  /* Rich text header/footer (from editor) */
  .rich-header {
    margin: 0 20px;
    padding: 12px 18px;
    page-break-inside: avoid;
  }
  .rich-header img { max-width: 100%; height: auto; }
  .rich-footer {
    margin: 16px 20px 0;
    padding: 12px 18px;
    page-break-inside: avoid;
  }
  .rich-footer img { max-width: 100%; height: auto; }

  @media print {
    body { padding: 0; background: white; }
    .statement-page { padding: 0; max-width: 100%; border-radius: 0; }
    .header-block { border-radius: 0; }
    .no-print { display: none !important; }
  }
  @media screen {
    body { padding: 20px 0; }
    .statement-page {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
      overflow: hidden;
      padding-bottom: 20px;
    }
  }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`
}
