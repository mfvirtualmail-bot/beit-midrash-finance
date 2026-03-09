import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  try {
    await supabase.from('member_payments').delete().eq('id', params.paymentId).eq('member_id', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
