import nodemailer from 'nodemailer'
import { supabase } from './supabase'

// Get email settings from DB
async function getEmailSettings() {
  const { data } = await supabase.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value ?? ''
  return {
    gmailUser: settings.gmail_user || process.env.GMAIL_USER || '',
    gmailAppPassword: settings.gmail_app_password || process.env.GMAIL_APP_PASSWORD || '',
    senderName: settings.email_sender_name || settings.org_name_he || 'בית המדרש',
    orgName: settings.org_name_he || 'בית המדרש',
    orgPhone: settings.org_phone || '',
    orgEmail: settings.org_email || '',
  }
}

function createTransport(gmailUser: string, gmailAppPassword: string) {
  if (!gmailUser || !gmailAppPassword) throw new Error('Gmail credentials not configured. Please set Gmail User and App Password in Settings.')
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  })
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

// ==================== TEMPLATES ====================

export interface EmailTemplate {
  id: number
  name: string
  subject: string
  body_html: string
  is_default: boolean
}

async function loadTemplate(templateId: number | null | undefined): Promise<EmailTemplate | null> {
  if (templateId) {
    const { data } = await supabase.from('email_templates').select('*').eq('id', templateId).single()
    if (data) return data as EmailTemplate
  }
  const { data: def } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_default', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (def) return def as EmailTemplate
  const { data: first } = await supabase
    .from('email_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (first as EmailTemplate) ?? null
}

function renderPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, key) => {
    const v = vars[key.toLowerCase()]
    return v === undefined ? '' : v
  })
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
  paymentLink?: string | null,
  templateId?: number | null,
) {
  const emailSettings = await getEmailSettings()
  const transporter = createTransport(emailSettings.gmailUser, emailSettings.gmailAppPassword)
  const template = await loadTemplate(templateId)

  const recentTable = buildRecentActivityTable(lines)
  const balanceFormatted = balance > 0 ? fmt(balance) : balance < 0 ? `זיכוי ${fmt(balance)}` : '€0.00'
  const balanceColor = balance > 0 ? '#1e40af' : '#16a34a'
  const balanceBg = balance > 0 ? '#eff6ff' : '#f0fdf4'
  const balanceBorder = balance > 0 ? '#bfdbfe' : '#bbf7d0'

  const vars: Record<string, string> = {
    member_name: memberName,
    balance: balanceFormatted,
    balance_raw: fmt(balance),
    total_charged: fmt(totalCharged),
    total_paid: fmt(totalPaid),
    org_name: emailSettings.orgName,
    date: new Date().toLocaleDateString('he-IL'),
  }

  const subject = template
    ? renderPlaceholders(template.subject, vars)
    : `דף חשבון מעודכן - ${memberName}`

  const messageHtml = template
    ? renderPlaceholders(template.body_html, vars)
    : `<p style="font-size:15px;color:#1e293b;margin:0 0 12px;">שלום <strong>${memberName}</strong>,</p>
       <p style="font-size:14px;color:#475569;margin:0 0 20px;">מצורף דף החשבון שלך. יתרה נוכחית: <strong>${balanceFormatted}</strong>.</p>`

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#3b82f6 100%);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:800;">${emailSettings.orgName}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">דף חשבון מעודכן</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-top:none;">
      <div style="font-size:14px;color:#1e293b;line-height:1.6;">${messageHtml}</div>

      <!-- Summary cards -->
      <div style="display:flex;gap:12px;margin:20px 0;">
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#dc2626;font-weight:600;">סה"כ חיובים</div>
          <div style="font-size:18px;font-weight:800;color:#dc2626;margin-top:4px;">${fmt(totalCharged)}</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#16a34a;font-weight:600;">סה"כ תשלומים</div>
          <div style="font-size:18px;font-weight:800;color:#16a34a;margin-top:4px;">${fmt(totalPaid)}</div>
        </div>
        <div style="flex:1;background:${balanceBg};border:1px solid ${balanceBorder};border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:${balanceColor};font-weight:600;">יתרה</div>
          <div style="font-size:18px;font-weight:800;color:${balanceColor};margin-top:4px;">${balanceFormatted}</div>
        </div>
      </div>

      <!-- Recent activity -->
      ${recentTable ? `
        <h3 style="font-size:13px;color:#475569;margin:0 0 8px;font-weight:600;">פעילות אחרונה:</h3>
        ${recentTable}
      ` : ''}

      <p style="font-size:13px;color:#64748b;margin:20px 0 0;">הדף המלא מצורף כקובץ PDF.</p>

      ${paymentLink && balance > 0 ? `
      <!-- Pay Now button -->
      <div style="margin-top:24px;text-align:center;">
        <a href="${paymentLink}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);color:white;font-size:16px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
          💳 שלם עכשיו — ${fmt(balance)}
        </a>
        <p style="font-size:11px;color:#94a3b8;margin:8px 0 0;">תשלום מאובטח דרך Stripe</p>
      </div>
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

  await transporter.sendMail({
    from: `"${emailSettings.senderName}" <${emailSettings.gmailUser}>`,
    to: memberEmail,
    subject,
    html,
    attachments: [
      {
        filename: pdfFileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

// ==================== PAYMENT CONFIRMATION EMAIL ====================

const METHOD_LABELS_HE: Record<string, string> = {
  cash: 'מזומן',
  bank: 'העברה בנקאית',
  bank_transfer: 'העברה בנקאית',
  check: "צ'ק",
  credit_card: 'כרטיס אשראי',
}

export async function sendPaymentConfirmationEmail(
  memberEmail: string,
  memberName: string,
  paymentAmount: number,
  paymentDate: string,
  newBalance: number,
  recentLines: Array<{ date: string; period: string; description: string; charge: number; payment: number }>,
  paymentMethod?: string | null,
) {
  const emailSettings = await getEmailSettings()
  const transporter = createTransport(emailSettings.gmailUser, emailSettings.gmailAppPassword)

  const recentTable = buildRecentActivityTable(recentLines)
  const balanceColor = newBalance > 0 ? '#1e40af' : '#16a34a'
  const balanceFormatted = newBalance > 0 ? fmt(newBalance) : newBalance < 0 ? `זיכוי ${fmt(newBalance)}` : '€0.00'

  // Only mention method if it's a known, meaningful value
  const methodLabel = paymentMethod && paymentMethod !== 'unknown' ? (METHOD_LABELS_HE[paymentMethod] || null) : null
  const methodRow = methodLabel
    ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:13px;color:#475569;">אמצעי תשלום</span>
        <span style="font-size:14px;font-weight:600;color:#1e293b;">${methodLabel}</span>
       </div>`
    : ''

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
        ${methodRow}
        <div style="border-top:1px solid #bbf7d0;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:${balanceColor};font-weight:600;">יתרה מעודכנת</span>
          <span style="font-size:18px;font-weight:800;color:${balanceColor};">${balanceFormatted}</span>
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

  await transporter.sendMail({
    from: `"${emailSettings.senderName}" <${emailSettings.gmailUser}>`,
    to: memberEmail,
    subject: `אישור תשלום - ${emailSettings.orgName}`,
    html,
  })
}
