import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (token) {
      const db = await getDb()
      db.run(`DELETE FROM sessions WHERE token = ?`, [token])
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(COOKIE_NAME)
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
