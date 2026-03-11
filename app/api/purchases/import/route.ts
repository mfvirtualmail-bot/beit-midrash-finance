import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// Expected columns:
// member / חבר / שם (required) — can be existing member or free-text "Other Name"
// amount / סכום (required)
// item / פריט / category / קטגוריה (optional)
// week / שבוע / חג / holiday / period / תקופה (optional — free text, Hebrew date, or holiday name)
// notes / הערות (optional)
function normalizeHeader(h: string): string {
  const s = h.trim().toLowerCase()
  if (['member', 'חבר', 'שם', 'name', 'member_name', 'שם חבר'].includes(s)) return 'member'
  if (['item', 'פריט', 'category', 'קטגוריה', 'סוג', 'type', 'סוג רכישה', 'purchase_type'].includes(s)) return 'item'
  if (['amount', 'סכום', 'sum', 'price', 'מחיר'].includes(s)) return 'amount'
  if (['week', 'שבוע', 'חג', 'holiday', 'period', 'תקופה', 'date', 'תאריך'].includes(s)) return 'week'
  if (['notes', 'הערות', 'note', 'remarks', 'הערה'].includes(s)) return 'notes'
  return s
}

// Parse dates in any common format → YYYY-MM-DD
function parseDate(value: string | number): string | null {
  if (typeof value === 'number' || /^\d{4,5}$/.test(String(value).trim())) {
    const serial = typeof value === 'number' ? value : parseInt(String(value).trim(), 10)
    if (serial > 1 && serial < 200000) {
      const epoch = new Date(1899, 11, 30)
      const date = new Date(epoch.getTime() + serial * 86400000)
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0]
    }
  }
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return isValidDate(y, m, d) ? fmtDate(y, m, d) : null
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/').map(Number)
    return isValidDate(y, m, d) ? fmtDate(y, m, d) : null
  }
  const match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (match) {
    const a = parseInt(match[1], 10), b = parseInt(match[2], 10), year = parseInt(match[3], 10)
    if (a > 12) return isValidDate(year, b, a) ? fmtDate(year, b, a) : null
    if (b > 12) return isValidDate(year, a, b) ? fmtDate(year, a, b) : null
    return isValidDate(year, b, a) ? fmtDate(year, b, a) : null
  }
  const d = new Date(s)
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
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

    // Load members and purchase categories for name matching
    const [{ data: members }, { data: categories }] = await Promise.all([
      supabase.from('members').select('id, name'),
      supabase.from('categories').select('id, name_he, name_en').eq('type', 'purchase'),
    ])

    const memberMap = new Map((members ?? []).map((m: { id: number; name: string }) => [m.name.trim().toLowerCase(), m.id]))
    const categoryMap = new Map((categories ?? []).map((c: { id: number; name_he: string; name_en: string }) => [c.name_he.trim().toLowerCase(), c.id]))
    for (const c of (categories ?? []) as Array<{ id: number; name_he: string; name_en: string }>) {
      if (c.name_en) categoryMap.set(c.name_en.trim().toLowerCase(), c.id)
    }

    const defaultDate = new Date().toISOString().split('T')[0]

    const transactions: Array<{
      type: string
      amount: number
      description_he: string
      description_en: string | null
      category_id: number | null
      member_id: number | null
      date: string
      notes: string | null
    }> = []
    const skipped: string[] = []

    for (let i = 0; i < normalized.length; i++) {
      const r = normalized[i]
      const amount = parseFloat(r.amount)
      if (!r.member || isNaN(amount) || amount <= 0) {
        skipped.push(`Row ${i + 2}: missing member/name or invalid amount`)
        continue
      }

      // Flexible member: try to match existing member, otherwise use as "Other Name"
      const memberId = memberMap.get(r.member.toLowerCase()) ?? null
      const memberName = r.member

      const categoryId = r.item ? (categoryMap.get(r.item.toLowerCase()) ?? null) : null
      const itemName = r.item || ''
      const weekLabel = r.week || ''

      // Build description: include week/holiday + item
      const descParts = [weekLabel, itemName].filter(Boolean)
      const descHe = descParts.length > 0 ? descParts.join(' - ') : memberName

      // Store member name in notes if not a system member (so it appears on invoices)
      const notesParts = []
      if (!memberId) notesParts.push(`[${memberName}]`)
      if (weekLabel) notesParts.push(weekLabel)
      if (r.notes) notesParts.push(r.notes)
      const notesStr = notesParts.length > 0 ? notesParts.join(' | ') : null

      // Parse date if provided in the week field (could be a date)
      let date = defaultDate
      if (r.week) {
        const parsed = parseDate(r.week)
        if (parsed) date = parsed
      }

      transactions.push({
        type: 'expense',
        amount,
        description_he: descHe,
        description_en: null,
        category_id: categoryId,
        member_id: memberId,
        date,
        notes: notesStr,
      })
    }

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No valid rows found', imported: 0, skipped }, { status: 400 })
    }

    // Insert one-by-one so partial failures don't block other rows
    let imported = 0
    for (let i = 0; i < transactions.length; i++) {
      const { error } = await supabase.from('transactions').insert(transactions[i]).select('id')
      if (!error) {
        imported++
      } else {
        skipped.push(`Row ${i + 2}: ${error.message}`)
      }
    }

    return NextResponse.json({ imported, total: normalized.length, skipped })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
