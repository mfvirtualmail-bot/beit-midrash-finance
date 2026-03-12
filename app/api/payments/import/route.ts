import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'
import * as XLSX from 'xlsx'

// Expected columns:
// member / חבר / שם (required) — must match existing member name
// amount / סכום (required)
// date / תאריך (optional — defaults to today)
// method / אמצעי תשלום (optional — cash/check/bank/credit_card)
// notes / הערות (optional)
function normalizeHeader(h: string): string {
  const s = h.trim().toLowerCase()
  if (['member', 'חבר', 'שם', 'name', 'member_name', 'שם חבר', 'משלם'].includes(s)) return 'member'
  if (['amount', 'סכום', 'sum', 'price', 'מחיר', 'תשלום'].includes(s)) return 'amount'
  if (['date', 'תאריך', 'payment_date', 'תאריך תשלום'].includes(s)) return 'date'
  if (['method', 'אמצעי תשלום', 'אמצעי', 'payment_method', 'שיטת תשלום', 'סוג תשלום'].includes(s)) return 'method'
  if (['notes', 'הערות', 'note', 'remarks', 'הערה', 'reference', 'אסמכתא'].includes(s)) return 'notes'
  return s
}

function normalizeMethod(m: string): string | null {
  const s = m.trim().toLowerCase()
  if (!s) return null
  if (['cash', 'מזומן', 'כסף מזומן'].includes(s)) return 'cash'
  if (['check', "צ'ק", 'שיק', 'cheque'].includes(s)) return 'check'
  if (['bank', 'bank_transfer', 'העברה', 'העברה בנקאית', 'transfer'].includes(s)) return 'bank'
  if (['credit', 'credit_card', 'כרטיס אשראי', 'אשראי', 'card'].includes(s)) return 'credit_card'
  return null
}

// Parse dates in any common format → YYYY-MM-DD
// Supports: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD, YYYY/MM/DD, Excel serial numbers
function parseDate(value: string | number): string | null {
  // Excel serial number (e.g. 46052)
  if (typeof value === 'number' || /^\d{4,5}$/.test(String(value).trim())) {
    const serial = typeof value === 'number' ? value : parseInt(String(value).trim(), 10)
    if (serial > 1 && serial < 200000) {
      // Excel epoch: Jan 0, 1900 (with the intentional leap year bug)
      const epoch = new Date(1899, 11, 30)
      const date = new Date(epoch.getTime() + serial * 86400000)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    }
  }

  const s = String(value).trim()
  if (!s) return null

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    if (isValidDate(y, m, d)) return formatDate(y, m, d)
    return null
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/').map(Number)
    if (isValidDate(y, m, d)) return formatDate(y, m, d)
    return null
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (match) {
    const a = parseInt(match[1], 10)
    const b = parseInt(match[2], 10)
    const year = parseInt(match[3], 10)

    // If first number > 12, it must be DD/MM/YYYY
    if (a > 12) {
      if (isValidDate(year, b, a)) return formatDate(year, b, a)
      return null
    }
    // If second number > 12, it must be MM/DD/YYYY
    if (b > 12) {
      if (isValidDate(year, a, b)) return formatDate(year, a, b)
      return null
    }
    // Both <= 12: assume DD/MM/YYYY (European/Israeli format)
    if (isValidDate(year, b, a)) return formatDate(year, b, a)
    return null
  }

  // Try native Date.parse as last resort
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }

  return null
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '', raw: true })

    if (rows.length === 0) return NextResponse.json({ error: 'Empty file', imported: 0 })

    // Normalize headers
    const normalized = rows.map(row => {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        out[normalizeHeader(k)] = String(v).trim()
      }
      return out
    })

    // Load existing members for name matching
    const { data: members } = await supabase.from('members').select('id, name')
    const memberMap = new Map(
      (members ?? []).map((m: { id: number; name: string }) => [m.name.trim().toLowerCase(), m.id])
    )

    const defaultDate = new Date().toISOString().split('T')[0]
    const payments: Array<{
      member_id: number
      amount: number
      date: string
      method: string
      reference: string | null
      notes: string | null
      created_by: number | null
    }> = []
    const skipped: string[] = []

    for (let i = 0; i < normalized.length; i++) {
      const r = normalized[i]
      const amount = parseFloat(r.amount)

      if (!r.member) {
        skipped.push(`Row ${i + 2}: missing member name`)
        continue
      }
      if (isNaN(amount) || amount <= 0) {
        skipped.push(`Row ${i + 2}: invalid amount "${r.amount}"`)
        continue
      }

      // Try to match member
      const memberId = memberMap.get(r.member.toLowerCase())
      if (!memberId) {
        skipped.push(`Row ${i + 2}: member "${r.member}" not found`)
        continue
      }

      const method = r.method ? normalizeMethod(r.method) : null

      // Parse date - handle all common formats
      let date = defaultDate
      if (r.date) {
        const parsed = parseDate(r.date)
        if (!parsed) {
          skipped.push(`Row ${i + 2}: invalid date format "${r.date}"`)
          continue
        }
        date = parsed
      }

      payments.push({
        member_id: memberId,
        amount,
        date,
        method,
        reference: null,
        notes: r.notes || null,
        created_by: userId,
      })
    }

    if (payments.length === 0) {
      return NextResponse.json({ error: 'No valid rows found', imported: 0, total: normalized.length, skipped }, { status: 400 })
    }

    // Insert one-by-one so partial failures don't block other rows
    let imported = 0
    for (let i = 0; i < payments.length; i++) {
      const { error } = await supabase.from('member_payments').insert(payments[i]).select('id')
      if (!error) {
        imported++
      } else {
        skipped.push(`Row: ${payments[i].notes || payments[i].date} — ${error.message}`)
      }
    }

    return NextResponse.json({ imported, total: normalized.length, skipped })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
