import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendStatementEmail } from '@/lib/email'
import { buildMemberStatementData, generateStatementHtml, loadOrgSettings } from '@/lib/statementPdf'
import { htmlToPdf } from '@/lib/htmlToPdf'
import Stripe from 'stripe'

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

    // Prepare PDF attachment — generate real PDF from HTML using headless Chromium
    let pdfBuffer: Buffer
    const pdfFileName = `דף_חשבון_${member.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

    if (pdfFile) {
      // Client sent a generated PDF
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    } else {
      // Generate HTML, then convert to real PDF via headless Chromium
      const orgSettings = await loadOrgSettings()
      const htmlContent = generateStatementHtml([statementData], orgSettings)
      pdfBuffer = await htmlToPdf(htmlContent)
    }

    // Optionally generate a Stripe payment link if balance > 0 and Stripe is configured
    let paymentLink: string | null = null
    if (balance > 0) {
      try {
        const { data: settingsRows } = await supabase.from('settings').select('key, value')
        const settings: Record<string, string> = {}
        for (const row of settingsRows ?? []) settings[row.key] = row.value ?? ''

        const stripeSecretKey = settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY || ''
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey)
          const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'
          const orgName = settings.org_name_he || 'בית המדרש'

          const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'eur',
                  product_data: {
                    name: `תשלום יתרה - ${member.name}`,
                    description: orgName,
                  },
                  unit_amount: Math.round(balance * 100),
                },
                quantity: 1,
              },
            ],
            customer_email: member.email || undefined,
            metadata: {
              member_id: String(member.id),
              member_name: member.name,
              org_name: orgName,
            },
            success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&member_id=${member.id}`,
            cancel_url: `${origin}/members/${member.id}`,
          })
          paymentLink = session.url
        }
      } catch (stripeErr) {
        // Non-fatal: send email without payment link if Stripe fails
        console.error('Stripe payment link generation failed:', stripeErr)
      }
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
      paymentLink,
    )

    return NextResponse.json({ ok: true, message: 'Email sent successfully', paymentLink })
  } catch (e) {
    console.error('Send statement email error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Vercel function config — Chromium needs more memory and time
export const maxDuration = 30
export const dynamic = 'force-dynamic'
