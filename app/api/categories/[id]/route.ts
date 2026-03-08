import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const body = await req.json()
    const { name_he, name_en, type, color } = body
    db.prepare(
      'UPDATE categories SET name_he=?, name_en=?, type=?, color=? WHERE id=?'
    ).run(name_he, name_en, type, color, params.id)
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(params.id)
    return NextResponse.json(category)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM categories WHERE id = ?').run(params.id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
