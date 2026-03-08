import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryOne, runSql } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const body = await req.json()
    const { type, amount, description_he, description_en, category_id, date, notes } = body
    runSql(db,
      'UPDATE transactions SET type=?, amount=?, description_he=?, description_en=?, category_id=?, date=?, notes=? WHERE id=?',
      [type, amount, description_he || null, description_en || null, category_id || null, date, notes || null, parseInt(params.id)]
    )

    const transaction = queryOne(db,
      `SELECT t.*, c.name_he as category_name_he, c.name_en as category_name_en, c.color as category_color
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [parseInt(params.id)]
    )
    return NextResponse.json(transaction)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    runSql(db, 'DELETE FROM transactions WHERE id = ?', [parseInt(params.id)])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
