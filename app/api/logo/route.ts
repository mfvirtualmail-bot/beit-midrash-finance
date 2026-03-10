import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'org_logo')
      .single()

    if (!data?.value) {
      return new NextResponse(null, { status: 404 })
    }

    // Parse data URL: data:image/png;base64,AAAA...
    const match = data.value.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) {
      return new NextResponse(null, { status: 404 })
    }

    const contentType = match[1]
    const buf = Buffer.from(match[2], 'base64')

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
