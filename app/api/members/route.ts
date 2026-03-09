import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryAll, queryOne, runSql } from '@/lib/db'
import { COOKIE_NAME } from '@/lib/auth'

async function getUserId(req: NextRequest, db: ReturnType<typeof getDb> extends Promise<infer T> ? T : never) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = queryOne(db, `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`, [token])
  return session ? (session.user_id as number) : null
}

export async function GET(req: NextRequest) {
  try {
    const db = await getDb()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    let sql = `
      SELECT m.*,
        COALESCE((SELECT SUM(amount) FROM member_charges WHERE member_id = m.id), 0) as total_charges,
        COALESCE((SELECT SUM(amount) FROM member_payments WHERE member_id = m.id), 0) as total_payments,
        COALESCE((SELECT SUM(amount) FROM member_payments WHERE member_id = m.id), 0) -
        COALESCE((SELECT SUM(amount) FROM member_charges WHERE member_id = m.id), 0) as balance
      FROM members m
      WHERE 1=1
    `
    const args: (string | number | null)[] = []
    if (search) {
      sql += ` AND (m.name LIKE ? OR m.phone LIKE ? OR m.email LIKE ?)`
      args.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    sql += ' ORDER BY m.name ASC'

    const members = queryAll(db, sql, args)
    return NextResponse.json(members)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb()
    const token = req.cookies.get(COOKIE_NAME)?.value
    const session = token ? queryOne(db, `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`, [token]) : null
    const userId = session ? (session.user_id as number) : null

    const { name, phone, email, address, notes } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const { lastId } = runSql(db,
      `INSERT INTO members (name, phone, email, address, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), phone || null, email || null, address || null, notes || null, userId]
    )
    const member = queryOne(db, `SELECT * FROM members WHERE id = ?`, [lastId])
    return NextResponse.json(member, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
