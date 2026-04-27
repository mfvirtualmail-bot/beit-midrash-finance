import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildMemberStatementData, generateStatementHtml, loadOrgSettings } from '@/lib/statementPdf'
import { renderStatementPdf } from '@/lib/pdfReact'
import { pdfDisposition } from '@/lib/pdfDisposition'

// GET /api/statements/pdf?member_ids=1,2,3&date_from=...&date_to=...&format=html
// Returns real PDF (rendered via @react-pdf/renderer) by default.
// Pass format=html to get the legacy rich-HTML preview (used for browser
// preview and as a fallback that still renders styled rich-text header/footer).
export async function GET(req: NextRequest) {
  try {
    const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
    const dateFrom = req.nextUrl.searchParams.get('date_from')
    const dateTo = req.nextUrl.searchParams.get('date_to')
    const format = req.nextUrl.searchParams.get('format')

    if (!memberIdsParam) {
      return NextResponse.json({ error: 'member_ids required' }, { status: 400 })
    }

    const memberIds = memberIdsParam.split(',').map(Number)

    const { data: members } = await supabase
      .from('members')
      .select('id, name, phone, email, address')
      .in('id', memberIds)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No members found' }, { status: 404 })
    }

    const memberData = await Promise.all(
      members.map(member => buildMemberStatementData(member.id, member, dateFrom, dateTo))
    )
    const orgSettings = await loadOrgSettings()

    if (format === 'html') {
      const html = generateStatementHtml(memberData, orgSettings)
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const pdfBuffer = await renderStatementPdf(memberData, orgSettings)

    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('[statements/pdf] renderStatementPdf returned empty buffer')
      return NextResponse.json({ error: 'PDF render produced empty output' }, { status: 500 })
    }

    const firstName = members[0]?.name?.replace(/\s+/g, '_') || 'statement'
    const filename = members.length === 1
      ? `דף_חשבון_${firstName}_${new Date().toISOString().split('T')[0]}.pdf`
      : `דפי_חשבון_${new Date().toISOString().split('T')[0]}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
        'Content-Disposition': pdfDisposition(filename, 'inline'),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[statements/pdf] error:', err)
    return NextResponse.json(
      { error: 'PDF render failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
