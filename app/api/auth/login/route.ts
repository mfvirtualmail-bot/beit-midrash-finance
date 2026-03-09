import { NextRequest, NextResponse } from 'next/server'
import { supabase, ensureSeeded } from '@/lib/supabase'
import { verifyPassword, createSessionToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded()
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })

    const { data: user } = await supabase.from('users').select('*').eq('username', username).single()
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = createSessionToken()
    await supabase.from('sessions').insert({
      token, user_id: user.id,
      expires_at: new Date(Date.now() + COOKIE_MAX_AGE * 1000).toISOString()
    })

    const res = NextResponse.json({ id: user.id, username: user.username, display_name: user.display_name })
    res.cookies.set(COOKIE_NAME, token, { httpOnly: true, maxAge: COOKIE_MAX_AGE, path: '/', sameSite: 'lax' })
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
