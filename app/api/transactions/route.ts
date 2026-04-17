import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { applyLabelOverrides } from '@/lib/hebrewDate'
import { fetchLabelOverrides } from '@/lib/labelOverrides'

function flattenTx(t: Record<string, unknown>) {
  const cat = t.categories as Record<string, string> | null
  return { ...t, categories: undefined,
    category_name_he: cat?.name_he ?? null,
    category_name_en: cat?.name_en ?? null,
    category_color: cat?.color ?? null,
  }
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'מזומן',
  bank: 'העברה בנקאית',
  check: "צ'ק",
  credit_card: 'כרטיס אשראי',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')

    let q = supabase.from('transactions').select('*, categories(name_he, name_en, color)')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)

    if (type) q = q.eq('type', type)
    if (category) q = q.eq('category_id', parseInt(category))
    if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`)
    if (year) q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    if (search) q = q.or(`description_he.ilike.%${search}%,description_en.ilike.%${search}%,notes.ilike.%${search}%`)

    const { data } = await q
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: any[] = (data ?? []).map(flattenTx)

    // Also fetch member payments and include them as income entries
    // (unless filtering by expense-only or specific category)
    if (type !== 'expense' && !category) {
      let pq = supabase.from('member_payments')
        .select('id, amount, date, method, reference, notes, member_id, members(name)')
        .order('date', { ascending: false }).limit(limit)

      if (month) pq = pq.gte('date', `${month}-01`).lte('date', `${month}-31`)
      if (year) pq = pq.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
      if (search) pq = pq.or(`notes.ilike.%${search}%,reference.ilike.%${search}%`)

      const { data: payments } = await pq
      for (const p of payments ?? []) {
        const memberName = ((p.members as unknown) as { name: string } | null)?.name || ''
        const methodLabel = (p.method && p.method !== 'unknown') ? (METHOD_LABELS[p.method] || p.method) : ''
        const descHe = methodLabel ? `תשלום - ${memberName} - ${methodLabel}` : `תשלום - ${memberName}`
        const descEn = methodLabel ? `Payment - ${memberName} - ${methodLabel}` : `Payment - ${memberName}`
        transactions.push({
          id: `payment-${p.id}`,
          type: 'income',
          amount: Number(p.amount),
          date: p.date,
          description_he: descHe,
          description_en: descEn,
          category_id: null,
          category_name_he: 'תשלומי חברים',
          category_name_en: 'Member Payments',
          category_color: '#22c55e',
          notes: p.notes || p.reference || null,
          member_id: p.member_id,
          is_member_payment: true,
        })
      }

      // Re-sort combined list by date descending
      transactions.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    }

    // Apply user label renames to description fields (doesn't mutate DB)
    const overrides = await fetchLabelOverrides()
    if (overrides.length > 0) {
      for (const t of transactions) {
        if (t.description_he) t.description_he = applyLabelOverrides(t.description_he, overrides)
        if (t.description_en) t.description_en = applyLabelOverrides(t.description_en, overrides)
      }
    }

    return NextResponse.json(transactions)
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { type, amount, description_he, description_en, category_id, date, notes, member_id } = await req.json()
    if (!type || !amount || !date) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    const { data } = await supabase.from('transactions')
      .insert({ type, amount, description_he: description_he||null, description_en: description_en||null,
        category_id: category_id||null, date, notes: notes||null, member_id: member_id||null })
      .select('*, categories(name_he, name_en, color)').single()
    return NextResponse.json(flattenTx(data as Record<string, unknown>), { status: 201 })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
