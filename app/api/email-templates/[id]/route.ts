import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', Number(params.id))
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const body = await req.json()
  const { name, subject, body_html, is_default, sort_order } = body ?? {}

  if (is_default) {
    await supabase.from('email_templates').update({ is_default: false }).neq('id', id)
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) update.name = name
  if (subject !== undefined) update.subject = subject
  if (body_html !== undefined) update.body_html = body_html
  if (is_default !== undefined) update.is_default = !!is_default
  if (sort_order !== undefined) update.sort_order = sort_order

  const { data, error } = await supabase
    .from('email_templates')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)

  const { data: tmpl } = await supabase
    .from('email_templates')
    .select('is_default')
    .eq('id', id)
    .single()

  if (tmpl?.is_default) {
    return NextResponse.json({ error: 'Cannot delete the default template' }, { status: 400 })
  }

  const { error } = await supabase.from('email_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
