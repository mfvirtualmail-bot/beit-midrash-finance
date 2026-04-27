import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { data: template, error } = await supabase
    .from('purchase_item_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: items } = await supabase
    .from('purchase_item_template_items')
    .select('id, label_he, sort_order')
    .eq('template_id', id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  return NextResponse.json({ ...template, items: items ?? [] })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const body = await req.json()
  const { template_key, label_he, sort_order, items } = body ?? {}

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (template_key !== undefined) update.template_key = String(template_key).trim()
  if (label_he !== undefined) update.label_he = String(label_he).trim()
  if (sort_order !== undefined) update.sort_order = sort_order

  const { data: template, error } = await supabase
    .from('purchase_item_templates')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace items wholesale if provided
  if (Array.isArray(items)) {
    await supabase.from('purchase_item_template_items').delete().eq('template_id', id)
    const rows = items
      .filter((it: { label_he?: string }) => it && typeof it.label_he === 'string' && it.label_he.trim())
      .map((it: { label_he: string }, idx: number) => ({
        template_id: id,
        label_he: it.label_he.trim(),
        sort_order: idx,
      }))
    if (rows.length > 0) {
      await supabase.from('purchase_item_template_items').insert(rows)
    }
  }

  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { error } = await supabase.from('purchase_item_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
