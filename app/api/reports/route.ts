import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const { data: txs } = await supabase.from('transactions')
      .select('*, categories(name_he, name_en, color)')
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)

    const all = txs ?? []

    // Monthly aggregation
    const monthMap: Record<string, { month: string; income: number; expense: number }> = {}
    for (const t of all) {
      const m = String(t.date).slice(0, 7)
      if (!monthMap[m]) monthMap[m] = { month: m, income: 0, expense: 0 }
      if (t.type === 'income') monthMap[m].income += Number(t.amount)
      else monthMap[m].expense += Number(t.amount)
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
    const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total)

    const totalIncome = all.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = all.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const summary = { total_income: totalIncome, total_expense: totalExpense, total_transactions: all.length }

    const { data: yearRows } = await supabase.from('transactions').select('date').order('date')
    const years = Array.from(new Set((yearRows ?? []).map(r => String(r.date).slice(0, 4)))).sort((a, b) => b.localeCompare(a)).map(y => ({ year: y }))

    return NextResponse.json({ monthly, byCategory, summary, years, year })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
