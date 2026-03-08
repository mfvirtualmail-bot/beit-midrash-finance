import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const categories = db.prepare('SELECT * FROM categories ORDER BY type, name_en').all()
    return NextResponse.json(categories)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const body = await req.json()
    const { name_he, name_en, type, color } = body
    if (!name_he || !name_en || !type || !color) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const result = db.prepare(
      'INSERT INTO categories (name_he, name_en, type, color) VALUES (?, ?, ?, ?)'
    ).run(name_he, name_en, type, color)
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(category, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
