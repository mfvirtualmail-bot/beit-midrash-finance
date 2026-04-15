import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { COOKIE_NAME, hashPassword } from '@/lib/auth'

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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value
    const admin = await isSuperAdmin(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const userId = parseInt(params.id, 10)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await req.json()
    const { username, password, role } = body

    // Validate input
    if (!username || username.trim() === '') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const updates: any = { username: username.trim() }

    // Update password if provided
    if (password && password.trim() !== '') {
      updates.password_hash = hashPassword(password)
    }

    // Update role if provided
    if (role && ['super_admin', 'user'].includes(role)) {
      updates.role = role
    }

    // Check for duplicate username (excluding current user)
    if (username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.trim())
        .single()

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
      }
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, username, display_name, role, created_at')
      .single()

    if (error) throw error
    return NextResponse.json(updatedUser)
  } catch (e) {
    console.error('Error updating user:', e)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
