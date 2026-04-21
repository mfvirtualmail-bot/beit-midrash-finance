import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, subject, body_html, is_default, sort_order } = body ?? {}

  if (!name || !subject || typeof body_html !== 'string') {
    return NextResponse.json({ error: 'name, subject, body_html are required' }, { status: 400 })
  }

  if (is_default) {
    await supabase.from('email_templates').update({ is_default: false }).neq('id', -1)
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      name,
      subject,
      body_html,
      is_default: !!is_default,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
