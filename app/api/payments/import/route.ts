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

function normalizeMethod(m: string): string {
  const s = m.trim().toLowerCase()
  if (['cash', 'מזומן', 'כסף מזומן'].includes(s)) return 'cash'
  if (['check', "צ'ק", 'שיק', 'cheque'].includes(s)) return 'check'
  if (['bank', 'bank_transfer', 'העברה', 'העברה בנקאית', 'transfer'].includes(s)) return 'bank'
  if (['credit', 'credit_card', 'כרטיס אשראי', 'אשראי', 'card'].includes(s)) return 'credit_card'
  return 'cash'
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
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

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

      const method = r.method ? normalizeMethod(r.method) : 'cash'
      const date = r.date || defaultDate

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

    // Insert in batches
    let imported = 0
    for (let i = 0; i < payments.length; i += 50) {
      const batch = payments.slice(i, i + 50)
      const { data, error } = await supabase.from('member_payments').insert(batch).select('id')
      if (!error) imported += (data ?? []).length
      else skipped.push(error.message)
    }

    return NextResponse.json({ imported, total: normalized.length, skipped })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
