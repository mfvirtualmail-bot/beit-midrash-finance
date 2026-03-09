import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'

export async function PUT(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { username, display_name } = await req.json()
    if (!username?.trim()) return NextResponse.json({ error: 'Username required' }, { status: 400 })
    if (!display_name?.trim()) return NextResponse.json({ error: 'Display name required' }, { status: 400 })

    // Check username not already taken by another user
    const { data: existing } = await supabase
      .from('users').select('id').eq('username', username.trim()).neq('id', userId).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 400 })

    const { error } = await supabase.from('users')
      .update({ username: username.trim(), display_name: display_name.trim() })
      .eq('id', userId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
