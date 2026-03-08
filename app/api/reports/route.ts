import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryAll, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const db = await getDb()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const monthly = queryAll(db, `
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
      GROUP BY month
      ORDER BY month
    `, [year])

    const byCategory = queryAll(db, `
      SELECT
        c.name_he, c.name_en, c.color, t.type,
        SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE strftime('%Y', t.date) = ?
      GROUP BY t.category_id, t.type
      ORDER BY total DESC
    `, [year])

    const summary = queryOne(db, `
      SELECT
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expense,
        COUNT(*) as total_transactions
      FROM transactions
      WHERE strftime('%Y', date) = ?
    `, [year])

    const years = queryAll(db, `
      SELECT DISTINCT strftime('%Y', date) as year FROM transactions ORDER BY year DESC
    `)

    return NextResponse.json({ monthly, byCategory, summary, years, year })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
