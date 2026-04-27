import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildMemberStatementData, generateStatementHtml, loadOrgSettings } from '@/lib/statementPdf'
import { renderStatementPdf } from '@/lib/pdfReact'

// GET /api/statements/pdf?member_ids=1,2,3&date_from=...&date_to=...&format=html
// Returns real PDF (rendered via @react-pdf/renderer) by default.
// Pass format=html to get the legacy rich-HTML preview (used for browser
// preview and as a fallback that still renders styled rich-text header/footer).
export async function GET(req: NextRequest) {
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
    return new NextResponse('<html><body><p>No members found</p></body></html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
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

  const firstName = members[0]?.name?.replace(/\s+/g, '_') || 'statement'
  const filename = members.length === 1
    ? `דף_חשבון_${firstName}_${new Date().toISOString().split('T')[0]}.pdf`
    : `דפי_חשבון_${new Date().toISOString().split('T')[0]}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
