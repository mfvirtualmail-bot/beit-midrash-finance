import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryOne, runSql } from '@/lib/db'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const token = req.cookies.get(COOKIE_NAME)?.value
    const session = token ? queryOne(db, `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`, [token]) : null
    const userId = session ? (session.user_id as number) : null

    const { amount, date, method, reference, notes } = await req.json()
    if (!amount || !date) {
      return NextResponse.json({ error: 'amount and date required' }, { status: 400 })
    }

    const { lastId } = runSql(db,
      `INSERT INTO member_payments (member_id, amount, date, method, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(params.id), Number(amount), date, method || 'cash', reference || null, notes || null, userId]
    )
    return NextResponse.json(queryOne(db, `SELECT * FROM member_payments WHERE id = ?`, [lastId]), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
