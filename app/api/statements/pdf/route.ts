import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildMemberStatementData, generateStatementHtml, loadOrgSettings } from '@/lib/statementPdf'

// GET /api/statements/pdf?member_ids=1,2,3&date_from=...&date_to=...
// Returns clean HTML optimized for A4 PDF rendering
export async function GET(req: NextRequest) {
  const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
  const dateFrom = req.nextUrl.searchParams.get('date_from')
  const dateTo = req.nextUrl.searchParams.get('date_to')

  if (!memberIdsParam) {
    return NextResponse.json({ error: 'member_ids required' }, { status: 400 })
  }

  const memberIds = memberIdsParam.split(',').map(Number)

  // Get members
  const { data: members } = await supabase
    .from('members')
    .select('id, name, phone, email, address')
    .in('id', memberIds)

  if (!members || members.length === 0) {
    return new NextResponse('<html><body><p>No members found</p></body></html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Build statement data for each member
  const memberData = await Promise.all(
    members.map(member => buildMemberStatementData(member.id, member, dateFrom, dateTo))
  )

  // Load org settings and generate HTML
  const orgSettings = await loadOrgSettings()
  const html = generateStatementHtml(memberData, orgSettings)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
