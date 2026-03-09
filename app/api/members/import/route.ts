import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// Expected columns (case-insensitive, aliases supported):
// name / שם | phone / טלפון | email / אימייל | address / כתובת | notes / הערות
function normalizeHeader(h: string): string {
  const s = h.trim().toLowerCase()
  if (['name', 'שם', 'fullname', 'full_name', 'full name', 'שם מלא'].includes(s)) return 'name'
  if (['phone', 'טלפון', 'mobile', 'נייד', 'tel'].includes(s)) return 'phone'
  if (['email', 'אימייל', 'mail', 'e-mail'].includes(s)) return 'email'
  if (['address', 'כתובת', 'addr'].includes(s)) return 'address'
  if (['notes', 'הערות', 'note', 'remarks', 'comment'].includes(s)) return 'notes'
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

    const members = normalized
      .filter(r => r.name)
      .map(r => ({
        name: r.name,
        phone: r.phone || null,
        email: r.email || null,
        address: r.address || null,
        notes: r.notes || null,
        active: 1,
      }))

    if (members.length === 0) return NextResponse.json({ error: 'No valid rows found (missing name column)', imported: 0 }, { status: 400 })

    // Insert in batches of 50
    let imported = 0
    const skipped: string[] = []
    for (let i = 0; i < members.length; i += 50) {
      const batch = members.slice(i, i + 50)
      const { data, error } = await supabase.from('members').insert(batch).select('id')
      if (!error) imported += (data ?? []).length
      else skipped.push(error.message)
    }

    return NextResponse.json({ imported, total: members.length, skipped })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
