import { Resend } from 'resend'
import { supabase } from './supabase'

// Get email settings from DB
async function getEmailSettings() {
  const { data } = await supabase.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value ?? ''
  return {
    apiKey: settings.resend_api_key || process.env.RESEND_API_KEY || '',
    senderEmail: settings.email_sender || 'onboarding@resend.dev',
    senderName: settings.org_name_he || 'בית המדרש',
    orgName: settings.org_name_he || 'בית המדרש',
    orgPhone: settings.org_phone || '',
    orgEmail: settings.org_email || '',
  }
}

function getResendClient(apiKey: string) {
  if (!apiKey) throw new Error('Resend API key not configured')
  return new Resend(apiKey)
}

// Format currency
const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Build last 3 transactions mini-table HTML
function buildRecentActivityTable(lines: Array<{ date: string; period: string; description: string; charge: number; payment: number }>) {
  const last3 = lines.slice(-3)
  if (last3.length === 0) return ''

  const rows = last3.map(l => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${l.period || l.date}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;">${l.description}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#dc2626;text-align:left;">${l.charge > 0 ? fmt(l.charge) : ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#16a34a;text-align:left;">${l.payment > 0 ? fmt(l.payment) : ''}</td>
    </tr>
  `).join('')

  return `
    <table dir="rtl" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;margin-top:16px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;text-align:right;font-size:11px;color:#475569;border-bottom:2px solid #e2e8f0;">תקופה</th>
          <th style="padding:8px 10px;text-align:right;font-size:11px;color:#475569;border-bottom:2px solid #e2e8f0;">תיאור</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#475569;border-bottom:2px solid #e2e8f0;">חיוב</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#475569;border-bottom:2px solid #e2e8f0;">תשלום</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

// ==================== STATEMENT EMAIL ====================

export async function sendStatementEmail(
  memberEmail: string,
  memberName: string,
  totalCharged: number,
  totalPaid: number,
  balance: number,
  lines: Array<{ date: string; period: string; description: string; charge: number; payment: number }>,
  pdfBuffer: Buffer,
  pdfFileName: string,
) {
  const emailSettings = await getEmailSettings()
  const resend = getResendClient(emailSettings.apiKey)

  const recentTable = buildRecentActivityTable(lines)

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#3b82f6 100%);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:800;">${emailSettings.orgName}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">דף חשבון</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-top:none;">
      <p style="font-size:15px;color:#1e293b;margin:0 0 20px;">שלום <strong>${memberName}</strong>,</p>
      <p style="font-size:14px;color:#475569;margin:0 0 20px;">מצורף בזאת דף החשבון שלך. להלן סיכום:</p>

      <!-- Summary cards -->
      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#dc2626;font-weight:600;">סה"כ חיובים</div>
          <div style="font-size:18px;font-weight:800;color:#dc2626;margin-top:4px;">${fmt(totalCharged)}</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#16a34a;font-weight:600;">סה"כ תשלומים</div>
          <div style="font-size:18px;font-weight:800;color:#16a34a;margin-top:4px;">${fmt(totalPaid)}</div>
        </div>
        <div style="flex:1;background:${balance > 0 ? '#eff6ff' : '#f0fdf4'};border:1px solid ${balance > 0 ? '#bfdbfe' : '#bbf7d0'};border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:${balance > 0 ? '#1e40af' : '#16a34a'};font-weight:600;">יתרה</div>
          <div style="font-size:18px;font-weight:800;color:${balance > 0 ? '#1e40af' : '#16a34a'};margin-top:4px;">${balance > 0 ? fmt(balance) : balance < 0 ? `זיכוי ${fmt(balance)}` : '€0.00'}</div>
        </div>
      </div>

      <!-- Recent activity -->
      ${recentTable ? `
        <h3 style="font-size:13px;color:#475569;margin:0 0 8px;font-weight:600;">פעילות אחרונה:</h3>
        ${recentTable}
      ` : ''}

      <p style="font-size:13px;color:#64748b;margin:20px 0 0;">הדף המלא מצורף כקובץ PDF.</p>
    </div>

    <!-- Footer -->
    <div style="background:#f1f5f9;padding:16px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">${emailSettings.orgName}</p>
      ${emailSettings.orgPhone || emailSettings.orgEmail ? `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">${[emailSettings.orgPhone, emailSettings.orgEmail].filter(Boolean).join(' · ')}</p>` : ''}
    </div>
  </div>
</body>
</html>`

  const { data, error } = await resend.emails.send({
    from: `${emailSettings.senderName} <${emailSettings.senderEmail}>`,
    to: [memberEmail],
    subject: `דף חשבון - ${emailSettings.orgName}`,
    html,
    attachments: [
      {
        filename: pdfFileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })

  if (error) throw new Error(error.message)
  return data
}

// ==================== PAYMENT CONFIRMATION EMAIL ====================

export async function sendPaymentConfirmationEmail(
  memberEmail: string,
  memberName: string,
  paymentAmount: number,
  paymentDate: string,
  newBalance: number,
  recentLines: Array<{ date: string; period: string; description: string; charge: number; payment: number }>,
) {
  const emailSettings = await getEmailSettings()
  const resend = getResendClient(emailSettings.apiKey)

  const recentTable = buildRecentActivityTable(recentLines)

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#15803d 0%,#16a34a 100%);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:800;">${emailSettings.orgName}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">אישור תשלום</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-top:none;">
      <p style="font-size:15px;color:#1e293b;margin:0 0 20px;">שלום <strong>${memberName}</strong>,</p>
      <p style="font-size:14px;color:#475569;margin:0 0 20px;">קיבלנו את התשלום שלך. להלן הפרטים:</p>

      <!-- Payment details -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:13px;color:#16a34a;font-weight:600;">סכום ששולם</span>
          <span style="font-size:22px;font-weight:800;color:#16a34a;">${fmt(paymentAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:13px;color:#475569;">תאריך</span>
          <span style="font-size:14px;font-weight:600;color:#1e293b;">${paymentDate}</span>
        </div>
        <div style="border-top:1px solid #bbf7d0;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:${newBalance > 0 ? '#1e40af' : '#16a34a'};font-weight:600;">יתרה מעודכנת</span>
          <span style="font-size:18px;font-weight:800;color:${newBalance > 0 ? '#1e40af' : '#16a34a'};">${newBalance > 0 ? fmt(newBalance) : newBalance < 0 ? `זיכוי ${fmt(newBalance)}` : '€0.00'}</span>
        </div>
      </div>

      <!-- Recent activity -->
      ${recentTable ? `
        <h3 style="font-size:13px;color:#475569;margin:0 0 8px;font-weight:600;">פעילות אחרונה:</h3>
        ${recentTable}
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f1f5f9;padding:16px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">${emailSettings.orgName}</p>
      ${emailSettings.orgPhone || emailSettings.orgEmail ? `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">${[emailSettings.orgPhone, emailSettings.orgEmail].filter(Boolean).join(' · ')}</p>` : ''}
    </div>
  </div>
</body>
</html>`

  const { data, error } = await resend.emails.send({
    from: `${emailSettings.senderName} <${emailSettings.senderEmail}>`,
    to: [memberEmail],
    subject: `אישור תשלום - ${emailSettings.orgName}`,
    html,
  })

  if (error) throw new Error(error.message)
  return data
}
