import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data: templates, error } = await supabase
    .from('purchase_item_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (templates ?? []).map(t => t.id)
  let itemsByTemplate: Record<number, Array<{ id: number; label_he: string; sort_order: number }>> = {}
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('purchase_item_template_items')
      .select('id, template_id, label_he, sort_order')
      .in('template_id', ids)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    for (const it of items ?? []) {
      const arr = itemsByTemplate[it.template_id] ??= []
      arr.push({ id: it.id, label_he: it.label_he, sort_order: it.sort_order })
    }
  }

  const result = (templates ?? []).map(t => ({ ...t, items: itemsByTemplate[t.id] ?? [] }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { template_key, label_he, sort_order, items } = body ?? {}

  if (!template_key || !label_he) {
    return NextResponse.json({ error: 'template_key and label_he are required' }, { status: 400 })
  }

  const { data: template, error } = await supabase
    .from('purchase_item_templates')
    .insert({
      template_key: String(template_key).trim(),
      label_he: String(label_he).trim(),
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(items) && items.length > 0) {
    const rows = items
      .filter((it: { label_he?: string }) => it && typeof it.label_he === 'string' && it.label_he.trim())
      .map((it: { label_he: string }, idx: number) => ({
        template_id: template.id,
        label_he: it.label_he.trim(),
        sort_order: idx,
      }))
    if (rows.length > 0) {
      await supabase.from('purchase_item_template_items').insert(rows)
    }
  }

  return NextResponse.json(template)
}
