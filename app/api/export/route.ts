import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    let q = supabase.from('transactions').select('date, type, amount, description_he, description_en, notes, categories(name_he, name_en)').order('date', { ascending: false })
    if (year) q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`)
    const { data: txs } = await q

    const rows = (txs ?? []).map(t => {
      const cat = t.categories as unknown as { name_he: string; name_en: string } | null
      return {
        'תאריך / Date': t.date,
        'סוג / Type': t.type === 'income' ? 'הכנסה / Income' : 'הוצאה / Expense',
        'סכום / Amount (€)': Number(t.amount),
        'קטגוריה / Category (HE)': cat?.name_he ?? '',
        'Category (EN)': cat?.name_en ?? '',
        'תיאור / Description (HE)': t.description_he ?? '',
        'Description (EN)': t.description_en ?? '',
        'הערות / Notes': t.notes ?? '',
      }
    })

    if (format === 'csv') {
      if (rows.length === 0) return new NextResponse('No data', { status: 404 })
      const headers = Object.keys(rows[0])
      const csv = [headers.join(','), ...rows.map(row => headers.map(h => {
        const val = String((row as Record<string,unknown>)[h] ?? '')
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
      }).join(','))].join('\n')
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="finance-export.csv"' } })
    }

    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    const totalIncome = rows.filter(r => String(r['סוג / Type']).includes('הכנסה')).reduce((s, r) => s + (Number(r['סכום / Amount (€)']) || 0), 0)
    const totalExpense = rows.filter(r => String(r['סוג / Type']).includes('הוצאה')).reduce((s, r) => s + (Number(r['סכום / Amount (€)']) || 0), 0)
    const ws2 = XLSX.utils.json_to_sheet([
      { 'פריט / Item': 'סה"כ הכנסות / Total Income', 'סכום / Amount (€)': totalIncome },
      { 'פריט / Item': 'סה"כ הוצאות / Total Expenses', 'סכום / Amount (€)': totalExpense },
      { 'פריט / Item': 'יתרה / Balance', 'סכום / Amount (€)': totalIncome - totalExpense },
    ])
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="finance-export.xlsx"' } })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
