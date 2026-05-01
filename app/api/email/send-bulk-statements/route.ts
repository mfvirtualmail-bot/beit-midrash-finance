import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendBulkStatementsEmail } from '@/lib/email'
import { buildMemberStatementData, loadOrgSettings } from '@/lib/statementPdf'
import { renderStatementPdf } from '@/lib/pdfReact'

// POST /api/email/send-bulk-statements
// Body: { to: string, date_from?: string, date_to?: string }
// Renders statements for ALL active members into one PDF and emails it to `to`.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const to: string = (body?.to || '').trim()
    const dateFrom: string | null = body?.date_from || null
    const dateTo: string | null = body?.date_to || null

    if (!to) return NextResponse.json({ error: 'recipient email required' }, { status: 400 })
    if (!/^\S+@\S+\.\S+$/.test(to)) return NextResponse.json({ error: 'invalid email address' }, { status: 400 })

    // Active members only — members.active is integer (1/0) in this schema.
    const { data: members, error: memErr } = await supabase
      .from('members')
      .select('id, name, phone, email, address')
      .eq('active', 1)
      .order('name', { ascending: true })

    if (memErr) {
      console.error('[send-bulk-statements] members query error:', memErr)
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
    }
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No active members found' }, { status: 404 })
    }

    const memberData = await Promise.all(
      members.map(m => buildMemberStatementData(m.id, m, dateFrom, dateTo))
    )
    const orgSettings = await loadOrgSettings()
    const pdfBuffer = await renderStatementPdf(memberData, orgSettings)

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json({ error: 'PDF render produced empty output' }, { status: 500 })
    }

    const today = new Date().toISOString().split('T')[0]
    const fileName = `דפי_חשבון_כל_החברים_${today}.pdf`

    await sendBulkStatementsEmail(to, pdfBuffer, fileName, members.length, dateFrom, dateTo)

    return NextResponse.json({ ok: true, count: members.length })
  } catch (e) {
    console.error('[send-bulk-statements] error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'
