import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'

// Check if user is super_admin
async function isSuperAdmin(token?: string): Promise<boolean> {
  if (!token) return false
  try {
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single()
    if (!session) return false

    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user_id)
      .single()
    return user?.role === 'super_admin'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    const admin = await isSuperAdmin(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, created_at')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(users)
  } catch (e) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
