import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryOne, queryAll, runSql } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const member = queryOne(db, `
      SELECT m.*,
        COALESCE((SELECT SUM(amount) FROM member_charges WHERE member_id = m.id), 0) as total_charges,
        COALESCE((SELECT SUM(amount) FROM member_payments WHERE member_id = m.id), 0) as total_payments,
        COALESCE((SELECT SUM(amount) FROM member_payments WHERE member_id = m.id), 0) -
        COALESCE((SELECT SUM(amount) FROM member_charges WHERE member_id = m.id), 0) as balance
      FROM members m WHERE m.id = ?`, [Number(params.id)])
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const charges = queryAll(db, `
      SELECT mc.*, u.display_name as created_by_name
      FROM member_charges mc LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.member_id = ? ORDER BY mc.date DESC`, [Number(params.id)])

    const payments = queryAll(db, `
      SELECT mp.*, u.display_name as created_by_name
      FROM member_payments mp LEFT JOIN users u ON mp.created_by = u.id
      WHERE mp.member_id = ? ORDER BY mp.date DESC`, [Number(params.id)])

    return NextResponse.json({ member, charges, payments })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const { name, phone, email, address, notes } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    runSql(db, `UPDATE members SET name=?, phone=?, email=?, address=?, notes=? WHERE id=?`,
      [name.trim(), phone || null, email || null, address || null, notes || null, Number(params.id)])
    const member = queryOne(db, `SELECT * FROM members WHERE id = ?`, [Number(params.id)])
    return NextResponse.json(member)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    runSql(db, `DELETE FROM members WHERE id = ?`, [Number(params.id)])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
