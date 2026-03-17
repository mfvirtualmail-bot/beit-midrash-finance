import { createClient } from '@supabase/supabase-js'
import { hashPassword } from './auth'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-key',
  { auth: { persistSession: false } }
)

// Seed default data on first run
export async function ensureSeeded() {
  try {
    const { count: catCount } = await supabase
      .from('categories').select('*', { count: 'exact', head: true })
    if (catCount === 0) {
      await supabase.from('categories').insert([
        { name_he: 'תרומות', name_en: 'Donations', type: 'income', color: '#22c55e' },
        { name_he: 'שכר לימוד', name_en: 'Tuition', type: 'income', color: '#16a34a' },
        { name_he: 'מענקים', name_en: 'Grants', type: 'income', color: '#15803d' },
        { name_he: 'אירועים', name_en: 'Events', type: 'income', color: '#4ade80' },
        { name_he: 'שכר דירה', name_en: 'Rent', type: 'expense', color: '#ef4444' },
        { name_he: 'שכר עובדים', name_en: 'Salaries', type: 'expense', color: '#dc2626' },
        { name_he: 'חשמל ומים', name_en: 'Utilities', type: 'expense', color: '#f97316' },
        { name_he: 'ספרים וציוד', name_en: 'Books & Supplies', type: 'expense', color: '#a855f7' },
        { name_he: 'אחזקה', name_en: 'Maintenance', type: 'expense', color: '#f59e0b' },
        { name_he: 'אחר', name_en: 'Other', type: 'expense', color: '#6b7280' },
      ])
    }

    const { count: userCount } = await supabase
      .from('users').select('*', { count: 'exact', head: true })
    if (userCount === 0) {
      await supabase.from('users').insert([
        { username: 'admin', password_hash: hashPassword('admin123'), display_name: 'מנהל / Admin' },
      ])
    }
  } catch (e) {
    console.error('Seed error:', e)
  }
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()
  return session ? (session.user_id as number) : null
}
