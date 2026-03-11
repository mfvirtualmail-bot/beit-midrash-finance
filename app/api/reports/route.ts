import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const { data: txs } = await supabase.from('transactions')
      .select('*, categories(name_he, name_en, color)')
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)

    // Also fetch member payments as income
    const { data: memberPayments } = await supabase.from('member_payments')
      .select('id, amount, date, method, member_id, members(name)')
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)

    const all = txs ?? []
    const payments = memberPayments ?? []

    // Monthly aggregation
    const monthMap: Record<string, { month: string; income: number; expense: number }> = {}
    for (const t of all) {
      const m = String(t.date).slice(0, 7)
      if (!monthMap[m]) monthMap[m] = { month: m, income: 0, expense: 0 }
      if (t.type === 'income') monthMap[m].income += Number(t.amount)
      else monthMap[m].expense += Number(t.amount)
    }
    // Add member payments as income
    for (const p of payments) {
      const m = String(p.date).slice(0, 7)
      if (!monthMap[m]) monthMap[m] = { month: m, income: 0, expense: 0 }
      monthMap[m].income += Number(p.amount)
    }
    const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))

    // By category aggregation
    const catMap: Record<string, { name_he: string; name_en: string; color: string; type: string; total: number }> = {}
    for (const t of all) {
      const cat = t.categories as { name_he: string; name_en: string; color: string } | null
      const key = `${t.category_id}-${t.type}`
      if (!catMap[key]) catMap[key] = { name_he: cat?.name_he ?? '', name_en: cat?.name_en ?? '', color: cat?.color ?? '#ccc', type: t.type, total: 0 }
      catMap[key].total += Number(t.amount)
    }
    // Add member payments as a special income category
    if (payments.length > 0) {
      const paymentTotal = payments.reduce((s, p) => s + Number(p.amount), 0)
      catMap['member-payments-income'] = {
        name_he: 'תשלומי חברים',
        name_en: 'Member Payments',
        color: '#22c55e',
        type: 'income',
        total: paymentTotal,
      }
    }
    const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total)

    const totalIncome = all.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      + payments.reduce((s, p) => s + Number(p.amount), 0)
    const totalExpense = all.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const summary = { total_income: totalIncome, total_expense: totalExpense, total_transactions: all.length + payments.length }

    const { data: yearRows } = await supabase.from('transactions').select('date').order('date')
    const { data: paymentYearRows } = await supabase.from('member_payments').select('date').order('date')
    const allYears = new Set([
      ...(yearRows ?? []).map(r => String(r.date).slice(0, 4)),
      ...(paymentYearRows ?? []).map(r => String(r.date).slice(0, 4)),
    ])
    const years = Array.from(allYears).sort((a, b) => b.localeCompare(a)).map(y => ({ year: y }))

    return NextResponse.json({ monthly, byCategory, summary, years, year })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
