import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildMemberStatementData, generateStatementHtml, loadOrgSettings } from '@/lib/statementPdf'
import { htmlToPdf } from '@/lib/htmlToPdf'

// GET /api/statements/pdf?member_ids=1,2,3&date_from=...&date_to=...&format=html
// Returns real PDF by default. Pass format=html to get HTML (for browser preview).
export async function GET(req: NextRequest) {
  const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
  const dateFrom = req.nextUrl.searchParams.get('date_from')
  const dateTo = req.nextUrl.searchParams.get('date_to')
  const format = req.nextUrl.searchParams.get('format')

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

  // Return HTML for browser preview
  if (format === 'html') {
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Convert to real PDF using headless Chromium
  const pdfBuffer = await htmlToPdf(html)

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

// Vercel function config — Chromium needs more memory and time
export const maxDuration = 30
export const dynamic = 'force-dynamic'
