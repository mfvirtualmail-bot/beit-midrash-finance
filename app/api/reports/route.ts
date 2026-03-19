import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const dateGte = `${year}-01-01`
    const dateLte = `${year}-12-31`

    // 1. Regular transactions (income / expense / purchase)
    const { data: txs } = await supabase.from('transactions')
      .select('*, categories(name_he, name_en, color)')
      .gte('date', dateGte).lte('date', dateLte)

    // 2. Member payments (actual cash received from members)
    const { data: memberPayments } = await supabase.from('member_payments')
      .select('id, amount, date, method, member_id, members(name)')
      .gte('date', dateGte).lte('date', dateLte)

    // 3. Member charges (membership fees charged — pledges)
    const { data: memberCharges } = await supabase.from('member_charges')
      .select('id, amount, date')
      .gte('date', dateGte).lte('date', dateLte)

    // 4. Donor donations (actual income from donors)
    const { data: donorDonations } = await supabase.from('donor_donations')
      .select('id, amount, date')
      .gte('date', dateGte).lte('date', dateLte)

    const all = txs ?? []
    const payments = memberPayments ?? []
    const charges = memberCharges ?? []
    const donations = donorDonations ?? []

    // ── Financial breakdown ──────────────────────────────────────────────────
    // Charges = what members OWE (pledges, not yet cash)
    //   • member_charges (monthly membership fees)
    //   • transactions with type='purchase' (aliyot / weekly purchases)
    const purchaseTxs = all.filter(t => t.type === 'purchase')
    const totalCharged =
      charges.reduce((s, c) => s + Number(c.amount), 0) +
      purchaseTxs.reduce((s, t) => s + Number(t.amount), 0)

    // Collected = actual cash received from members
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0)

    // Outstanding = still owed by members
    const totalOutstanding = Math.max(0, totalCharged - totalCollected)

    // Other income = income transactions (sales, external income) + donor donations
    const incomeTxTotal = all.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const donationTotal = donations.reduce((s, d) => s + Number(d.amount), 0)
    const totalOtherIncome = incomeTxTotal + donationTotal

    // Actual income = money actually in hand
    const totalActualIncome = totalCollected + totalOtherIncome

    // Expenses = real institutional costs
    const totalExpenses = all.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    // Net balance (actual cash): money received minus expenses
    const netBalance = totalActualIncome - totalExpenses

    // Theoretical net (if every pledge is paid): charged + other income - expenses
    const netWithPledges = totalCharged + totalOtherIncome - totalExpenses

    const summary = {
      total_charged: totalCharged,
      total_collected: totalCollected,
      total_outstanding: totalOutstanding,
      total_other_income: totalOtherIncome,
      total_donations: donationTotal,
      total_actual_income: totalActualIncome,
      total_expenses: totalExpenses,
      net_balance: netBalance,
      net_with_pledges: netWithPledges,
      // Legacy fields for backward compatibility
      total_income: totalActualIncome,
      total_expense: totalExpenses,
      total_transactions: all.length + payments.length,
    }

    // ── Monthly aggregation ──────────────────────────────────────────────────
    // Columns: charged, collected, otherIncome, expense (per month)
    const monthMap: Record<string, {
      month: string
      charged: number
      collected: number
      other_income: number
      expense: number
      // legacy
      income: number
    }> = {}

    function ensureMonth(m: string) {
      if (!monthMap[m]) monthMap[m] = { month: m, charged: 0, collected: 0, other_income: 0, expense: 0, income: 0 }
    }

    for (const t of all) {
      const m = String(t.date).slice(0, 7)
      ensureMonth(m)
      if (t.type === 'income') { monthMap[m].other_income += Number(t.amount); monthMap[m].income += Number(t.amount) }
      else if (t.type === 'expense') monthMap[m].expense += Number(t.amount)
      else if (t.type === 'purchase') monthMap[m].charged += Number(t.amount)
    }
    for (const c of charges) {
      const m = String(c.date).slice(0, 7)
      ensureMonth(m)
      monthMap[m].charged += Number(c.amount)
    }
    for (const p of payments) {
      const m = String(p.date).slice(0, 7)
      ensureMonth(m)
      monthMap[m].collected += Number(p.amount)
      monthMap[m].income += Number(p.amount)
    }
    for (const d of donations) {
      const m = String(d.date).slice(0, 7)
      ensureMonth(m)
      monthMap[m].other_income += Number(d.amount)
      monthMap[m].income += Number(d.amount)
    }

    const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))

    // ── By category aggregation ──────────────────────────────────────────────
    const catMap: Record<string, { name_he: string; name_en: string; color: string; type: string; total: number }> = {}
    for (const t of all) {
      if (t.type === 'purchase') continue // purchases are in "charges", not income categories
      const cat = t.categories as { name_he: string; name_en: string; color: string } | null
      const key = `${t.category_id}-${t.type}`
      if (!catMap[key]) catMap[key] = { name_he: cat?.name_he ?? '', name_en: cat?.name_en ?? '', color: cat?.color ?? '#ccc', type: t.type, total: 0 }
      catMap[key].total += Number(t.amount)
    }
    // Member payments as special income category
    if (payments.length > 0) {
      catMap['member-payments-income'] = {
        name_he: 'תשלומי חברים',
        name_en: 'Member Payments',
        color: '#22c55e',
        type: 'income',
        total: totalCollected,
      }
    }
    // Donor donations as special income category
    if (donations.length > 0) {
      catMap['donor-donations-income'] = {
        name_he: 'תרומות',
        name_en: 'Donations',
        color: '#8b5cf6',
        type: 'income',
        total: donationTotal,
      }
    }
    const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total)

    // ── Years ────────────────────────────────────────────────────────────────
    const { data: yearRows } = await supabase.from('transactions').select('date').order('date')
    const { data: paymentYearRows } = await supabase.from('member_payments').select('date').order('date')
    const { data: chargeYearRows } = await supabase.from('member_charges').select('date').order('date')
    const allYears = new Set([
      ...(yearRows ?? []).map(r => String(r.date).slice(0, 4)),
      ...(paymentYearRows ?? []).map(r => String(r.date).slice(0, 4)),
      ...(chargeYearRows ?? []).map(r => String(r.date).slice(0, 4)),
    ])
    const years = Array.from(allYears).sort((a, b) => b.localeCompare(a)).map(y => ({ year: y }))

    return NextResponse.json({ monthly, byCategory, summary, years, year })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
