import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryOne, runSql } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const body = await req.json()
    const { name_he, name_en, type, color } = body
    runSql(db,
      'UPDATE categories SET name_he=?, name_en=?, type=?, color=? WHERE id=?',
      [name_he, name_en, type, color, parseInt(params.id)]
    )
    const category = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [parseInt(params.id)])
    return NextResponse.json(category)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    runSql(db, 'DELETE FROM categories WHERE id = ?', [parseInt(params.id)])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
