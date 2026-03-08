import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'monthly' // monthly | yearly
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    // Monthly totals for a given year
    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
      GROUP BY month
      ORDER BY month
    `).all(year)

    // By category totals for a given year
    const byCategory = db.prepare(`
      SELECT
        c.name_he, c.name_en, c.color, t.type,
        SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE strftime('%Y', t.date) = ?
      GROUP BY t.category_id, t.type
      ORDER BY total DESC
    `).all(year)

    // Overall summary
    const summary = db.prepare(`
      SELECT
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expense,
        COUNT(*) as total_transactions
      FROM transactions
      WHERE strftime('%Y', date) = ?
    `).get(year)

    // Available years
    const years = db.prepare(`
      SELECT DISTINCT strftime('%Y', date) as year FROM transactions ORDER BY year DESC
    `).all()

    return NextResponse.json({ monthly, byCategory, summary, years, year })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
