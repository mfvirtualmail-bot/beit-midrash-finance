import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// POST /api/stripe/webhook
// Stripe sends events here. On checkout.session.completed:
//   1. Creates a member_payment record
//   2. Sends payment confirmation email to member
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const sig = req.headers.get('stripe-signature')

    // Load settings
    const { data: settingsRows } = await supabase.from('settings').select('key, value')
    const settings: Record<string, string> = {}
    for (const row of settingsRows ?? []) settings[row.key] = row.value ?? ''

    const stripeSecretKey = settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY || ''
    const webhookSecret = settings.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || ''

    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })
    }

    const stripe = new Stripe(stripeSecretKey)

    let event: Stripe.Event

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    } else {
      // No webhook secret configured — parse the body directly (less secure, dev mode)
      event = JSON.parse(rawBody) as Stripe.Event
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const memberId = session.metadata?.member_id
      const memberName = session.metadata?.member_name
      const amountTotal = session.amount_total // in cents
      const currency = session.currency

      if (!memberId || !amountTotal) {
        console.error('Stripe webhook: missing member_id or amount_total in metadata')
        return NextResponse.json({ ok: true })
      }

      const amountEur = amountTotal / 100

      // Create payment record in member_payments
      const today = new Date().toISOString().split('T')[0]
      const { error: paymentError } = await supabase.from('member_payments').insert({
        member_id: Number(memberId),
        amount: amountEur,
        date: today,
        method: 'stripe',
        reference: session.id,
        notes: `תשלום אונליין דרך Stripe (${session.id})`,
      })

      if (paymentError) {
        console.error('Stripe webhook: failed to create payment record:', paymentError)
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
      }

      // Send payment confirmation email if member has email
      try {
        const { data: member } = await supabase
          .from('members')
          .select('id, name, email')
          .eq('id', Number(memberId))
          .single()

        if (member?.email) {
          // Calculate updated balance
          const { data: charges } = await supabase
            .from('member_charges')
            .select('amount')
            .eq('member_id', Number(memberId))

          const { data: payments } = await supabase
            .from('member_payments')
            .select('amount, date, method, reference')
            .eq('member_id', Number(memberId))

          const totalCharged = (charges ?? []).reduce((sum, c) => sum + Number(c.amount), 0)
          const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
          const balance = totalCharged - totalPaid

          await sendPaymentConfirmationEmail(
            member.email,
            member.name,
            amountEur,
            today,
            balance,
            [],
            'stripe',
          )
        }
      } catch (emailErr) {
        // Don't fail the webhook if email sending fails
        console.error('Stripe webhook: email sending failed:', emailErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Stripe webhook error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
