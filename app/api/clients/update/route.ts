import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ALLOWED_MEMBER_FIELDS = ['email', 'phone', 'address', 'notes', 'name']
const ALLOWED_DONOR_FIELDS = ['email', 'phone', 'address', 'notes', 'name_he', 'name_en']

export async function PUT(req: NextRequest) {
  try {
    const { source, id, field, value } = await req.json()

    if (!source || !id || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (source === 'member') {
      if (!ALLOWED_MEMBER_FIELDS.includes(field)) {
        return NextResponse.json({ error: 'Field not allowed' }, { status: 400 })
      }
      const { error } = await supabase
        .from('members')
        .update({ [field]: value || null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (source === 'donor') {
      if (!ALLOWED_DONOR_FIELDS.includes(field)) {
        return NextResponse.json({ error: 'Field not allowed' }, { status: 400 })
      }
      const { error } = await supabase
        .from('donors')
        .update({ [field]: value || null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
