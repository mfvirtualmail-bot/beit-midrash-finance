import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { formatHebrewDate, toHDate, getMonthNameHe, yearToGematriya, getHebrewPeriodSortIndex, getPaymentSortIndex } from '@/lib/hebrewDate'

// POST /api/email/payment-confirmation
// Body: { member_id, payment_amount, payment_date }
export async function POST(req: NextRequest) {
  try {
    const { member_id, payment_amount, payment_date, payment_method } = await req.json()
    if (!member_id || !payment_amount) {
      return NextResponse.json({ error: 'member_id and payment_amount required' }, { status: 400 })
    }

    // Get member
    const { data: member } = await supabase
      .from('members')
      .select('id, name, email')
      .eq('id', Number(member_id))
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!member.email) return NextResponse.json({ error: 'Member has no email address' }, { status: 400 })

    // Calculate current balance
    const { data: chargesData } = await supabase
      .from('member_charges')
      .select('amount')
      .eq('member_id', member_id)
    const { data: purchasesData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('member_id', member_id)
      .eq('type', 'purchase')
    const { data: paymentsData } = await supabase
      .from('member_payments')
      .select('amount')
      .eq('member_id', member_id)

    const totalCharges = (chargesData ?? []).reduce((s, r) => s + Number(r.amount), 0)
      + (purchasesData ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const totalPayments = (paymentsData ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const newBalance = totalCharges - totalPayments

    // Get last 3 lines for the email activity table
    const methodLabels: Record<string, string> = {
      cash: 'מזומן', bank: 'העברה בנקאית', check: "צ'ק", credit_card: 'כרטיס אשראי',
    }

    const { data: recentCharges } = await supabase.from('member_charges')
      .select('description, amount, date').eq('member_id', member_id)
      .order('date', { ascending: false }).limit(3)

    const { data: recentPayments } = await supabase.from('member_payments')
      .select('amount, date, method, reference').eq('member_id', member_id)
      .order('date', { ascending: false }).limit(3)

    const recentLines: Array<{ date: string; period: string; description: string; charge: number; payment: number }> = []

    for (const c of recentCharges ?? []) {
      let period = ''
      const feeMatch = c.description?.match(/דמי חבר\s*-\s*(.+)/)
      if (feeMatch) { period = feeMatch[1] }
      else {
        try {
          const hd = toHDate(c.date)
          period = `${getMonthNameHe(hd.getMonth(), hd.getFullYear())} ${yearToGematriya(hd.getFullYear())}`
        } catch { period = c.date }
      }
      recentLines.push({ date: c.date, period, description: 'דמי חבר', charge: Number(c.amount), payment: 0 })
    }

    for (const pay of recentPayments ?? []) {
      const ml = (pay.method && pay.method !== 'unknown') ? (methodLabels[pay.method] || pay.method) : ''
      const desc = ml ? `תשלום - ${ml}` : 'תשלום'
      recentLines.push({ date: pay.date, period: formatHebrewDate(pay.date, 'he'), description: desc, charge: 0, payment: Number(pay.amount) })
    }

    // Sort by date descending and take last 3
    recentLines.sort((a, b) => b.date.localeCompare(a.date))
    const last3 = recentLines.slice(0, 3).reverse()

    await sendPaymentConfirmationEmail(
      member.email,
      member.name,
      Number(payment_amount),
      payment_date || new Date().toISOString().split('T')[0],
      newBalance,
      last3,
      payment_method || null,
    )

    return NextResponse.json({ ok: true, message: 'Payment confirmation email sent' })
  } catch (e) {
    console.error('Send payment confirmation error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
