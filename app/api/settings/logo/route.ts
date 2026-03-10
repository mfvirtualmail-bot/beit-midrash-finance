import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function GET() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'org_logo')
      .single()
    if (!data?.value) return NextResponse.json({ logo: null })
    return NextResponse.json({ logo: data.value })
  } catch {
    return NextResponse.json({ logo: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('logo') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Not an image' }, { status: 400 })

    const buf = await file.arrayBuffer()
    const base64 = Buffer.from(buf).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'org_logo', value: dataUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await supabase.from('settings').delete().eq('key', 'org_logo')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
