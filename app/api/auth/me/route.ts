import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryOne } from '@/lib/db'
import { COOKIE_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token) return NextResponse.json(null)

    const db = await getDb()
    const user = queryOne(db,
      `SELECT u.id, u.username, u.display_name
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
      [token]
    )
    return NextResponse.json(user || null)
  } catch (e) {
    return NextResponse.json(null)
  }
}
