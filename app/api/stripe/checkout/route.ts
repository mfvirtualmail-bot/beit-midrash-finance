import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'

// GET /api/stripe/checkout?member_id=X&amount=Y
// Creates a Stripe Checkout Session and returns the URL
export async function POST(req: NextRequest) {
  try {
    const { member_id, amount, description } = await req.json()

    if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })

    // Load Stripe secret key from settings
    const { data: settingsRows } = await supabase.from('settings').select('key, value')
    const settings: Record<string, string> = {}
    for (const row of settingsRows ?? []) settings[row.key] = row.value ?? ''

    const stripeSecretKey = settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY || ''
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured. Add your Stripe Secret Key in Settings.' }, { status: 400 })
    }

    // Get member
    const { data: member } = await supabase
      .from('members')
      .select('id, name, email')
      .eq('id', Number(member_id))
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const orgName = settings.org_name_he || 'בית המדרש'
    const stripe = new Stripe(stripeSecretKey)

    // Determine base URL for success/cancel redirects
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: description || `תשלום - ${member.name}`,
              description: `${orgName}`,
            },
            unit_amount: Math.round(amount * 100), // cents
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

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e) {
    console.error('Stripe checkout error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
