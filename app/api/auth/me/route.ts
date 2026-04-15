import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token) return NextResponse.json(null)
    const { data: session } = await supabase.from('sessions').select('user_id')
      .eq('token', token).gt('expires_at', new Date().toISOString()).single()
    if (!session) return NextResponse.json(null)
    const { data: user } = await supabase.from('users')
      .select('id, username, display_name, role').eq('id', session.user_id).single()
    return NextResponse.json(user ?? null)
  } catch { return NextResponse.json(null) }
}
