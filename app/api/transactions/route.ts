import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryAll, queryOne, runSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const db = await getDb()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = `
      SELECT t.*, c.name_he as category_name_he, c.name_en as category_name_en, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE 1=1
    `
    const args: (string | number | null)[] = []

    if (type) { query += ' AND t.type = ?'; args.push(type) }
    if (category) { query += ' AND t.category_id = ?'; args.push(parseInt(category)) }
    if (month) { query += " AND strftime('%Y-%m', t.date) = ?"; args.push(month) }
    if (year) { query += " AND strftime('%Y', t.date) = ?"; args.push(year) }
    if (search) {
      query += ' AND (t.description_he LIKE ? OR t.description_en LIKE ? OR t.notes LIKE ?)'
      args.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ?'
    args.push(limit)

    const transactions = queryAll(db, query, args)
    return NextResponse.json(transactions)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb()
    const body = await req.json()
    const { type, amount, description_he, description_en, category_id, date, notes } = body
    if (!type || !amount || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const { lastId } = runSql(db,
      'INSERT INTO transactions (type, amount, description_he, description_en, category_id, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [type, amount, description_he || null, description_en || null, category_id || null, date, notes || null]
    )

    const transaction = queryOne(db,
      `SELECT t.*, c.name_he as category_name_he, c.name_en as category_name_en, c.color as category_color
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [lastId]
    )

    return NextResponse.json(transaction, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
