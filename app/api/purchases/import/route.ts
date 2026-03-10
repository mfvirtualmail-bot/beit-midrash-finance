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

export async function POST(req: NextRequest) {
  try {
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

      transactions.push({
        type: 'expense',
        amount,
        description_he: descHe,
        description_en: null,
        category_id: categoryId,
        member_id: memberId,
        date: defaultDate,
        notes: notesStr,
      })
    }

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No valid rows found', imported: 0, skipped }, { status: 400 })
    }

    // Insert in batches
    let imported = 0
    for (let i = 0; i < transactions.length; i += 50) {
      const batch = transactions.slice(i, i + 50)
      const { data, error } = await supabase.from('transactions').insert(batch).select('id')
      if (!error) imported += (data ?? []).length
      else skipped.push(error.message)
    }

    return NextResponse.json({ imported, total: normalized.length, skipped })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
