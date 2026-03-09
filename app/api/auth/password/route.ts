import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME, verifyPassword, hashPassword } from '@/lib/auth'

export async function PUT(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Password too short (min 4 chars)' }, { status: 400 })
    }

    const { data: user } = await supabase.from('users').select('password_hash').eq('id', userId).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (!verifyPassword(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 400 })
    }

    const newHash = hashPassword(newPassword)
    const { error } = await supabase.from('users').update({ password_hash: newHash }).eq('id', userId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
