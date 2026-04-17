import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('label_overrides')
      .select('*')
      .order('original_text')
    if (error) {
      console.error('labels GET error:', error)
      return NextResponse.json([])
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { original_text, replacement_text, notes } = await req.json()
    if (!original_text || !replacement_text) {
      return NextResponse.json({ error: 'original_text and replacement_text required' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('label_overrides')
      .insert({
        original_text: original_text.trim(),
        replacement_text: replacement_text.trim(),
        notes: notes || null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
