import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryAll, queryOne, runSql } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    const categories = queryAll(db, 'SELECT * FROM categories ORDER BY type, name_en')
    return NextResponse.json(categories)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb()
    const body = await req.json()
    const { name_he, name_en, type, color } = body
    if (!name_he || !name_en || !type || !color) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const { lastId } = runSql(db,
      'INSERT INTO categories (name_he, name_en, type, color) VALUES (?, ?, ?, ?)',
      [name_he, name_en, type, color]
    )
    const category = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [lastId])
    return NextResponse.json(category, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
