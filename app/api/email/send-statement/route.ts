import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendStatementEmail } from '@/lib/email'
import { buildMemberStatementData, generateStatementHtml, loadOrgSettings } from '@/lib/statementPdf'

// POST /api/email/send-statement
// Content-Type: multipart/form-data
// Fields: member_id (required), date_from, date_to, pdf (File - optional PDF attachment)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const memberId = formData.get('member_id') as string
    const dateFrom = formData.get('date_from') as string | null
    const dateTo = formData.get('date_to') as string | null
    const pdfFile = formData.get('pdf') as File | null

    if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

    // Get member
    const { data: member } = await supabase
      .from('members')
      .select('id, name, phone, email, address')
      .eq('id', Number(memberId))
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!member.email) return NextResponse.json({ error: 'Member has no email address' }, { status: 400 })

    // Build statement data using shared function
    const statementData = await buildMemberStatementData(
      Number(memberId),
      member,
      dateFrom,
      dateTo,
    )

    const { lines, totalCharged, totalPaid, balance } = statementData

    // Prepare PDF attachment
    let pdfBuffer: Buffer
    const pdfFileName = `דף_חשבון_${member.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`

    if (pdfFile) {
      // Client sent a generated PDF
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    } else {
      // Generate HTML statement directly (no HTTP self-fetch)
      const orgSettings = await loadOrgSettings()
      const htmlContent = generateStatementHtml([statementData], orgSettings)
      pdfBuffer = Buffer.from(htmlContent, 'utf-8')
    }

    await sendStatementEmail(
      member.email,
      member.name,
      totalCharged,
      totalPaid,
      balance,
      lines,
      pdfBuffer,
      pdfFileName,
    )

    return NextResponse.json({ ok: true, message: 'Email sent successfully' })
  } catch (e) {
    console.error('Send statement email error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
