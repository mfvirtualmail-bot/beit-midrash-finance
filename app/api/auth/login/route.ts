import { NextRequest, NextResponse } from 'next/server'
import { getDb, queryOne, runSql } from '@/lib/db'
import { verifyPassword, createSessionToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const db = await getDb()
    const user = queryOne(db, `SELECT * FROM users WHERE username = ?`, [username])
    if (!user || !verifyPassword(password, String(user.password_hash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = createSessionToken()
    const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toISOString().replace('T', ' ').slice(0, 19)
    runSql(db, `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      [token, user.id as number, expires])

    const res = NextResponse.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
    })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
