import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryAll } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const db = await getDb()
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    let query = `
      SELECT
        t.date as "תאריך / Date",
        CASE t.type WHEN 'income' THEN 'הכנסה / Income' ELSE 'הוצאה / Expense' END as "סוג / Type",
        t.amount as "סכום / Amount (₪)",
        COALESCE(c.name_he, '') as "קטגוריה / Category (HE)",
        COALESCE(c.name_en, '') as "Category (EN)",
        COALESCE(t.description_he, '') as "תיאור / Description (HE)",
        COALESCE(t.description_en, '') as "Description (EN)",
        COALESCE(t.notes, '') as "הערות / Notes"
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE 1=1
    `
    const args: (string | number | null)[] = []
    if (year) { query += ` AND strftime('%Y', t.date) = ?`; args.push(year) }
    if (month) { query += ` AND strftime('%Y-%m', t.date) = ?`; args.push(month) }
    query += ' ORDER BY t.date DESC'

    const rows = queryAll(db, query, args)

    if (format === 'csv') {
      if (rows.length === 0) {
        return new NextResponse('No data', { status: 404 })
      }
      const headers = Object.keys(rows[0])
      const csv = [
        headers.join(','),
        ...rows.map(row =>
          headers.map(h => {
            const val = String(row[h] ?? '')
            return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
          }).join(',')
        )
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="finance-export.csv"`,
        }
      })
    }

    // XLSX
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')

    const totalIncome = rows.filter(r => String(r['סוג / Type']).includes('הכנסה')).reduce((s, r) => s + (Number(r['סכום / Amount (₪)']) || 0), 0)
    const totalExpense = rows.filter(r => String(r['סוג / Type']).includes('הוצאה')).reduce((s, r) => s + (Number(r['סכום / Amount (₪)']) || 0), 0)
    const summary = [
      { 'פריט / Item': 'סה"כ הכנסות / Total Income', 'סכום / Amount (₪)': totalIncome },
      { 'פריט / Item': 'סה"כ הוצאות / Total Expenses', 'סכום / Amount (₪)': totalExpense },
      { 'פריט / Item': 'יתרה / Balance', 'סכום / Amount (₪)': totalIncome - totalExpense },
    ]
    const ws2 = XLSX.utils.json_to_sheet(summary)
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="finance-export.xlsx"`,
      }
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
