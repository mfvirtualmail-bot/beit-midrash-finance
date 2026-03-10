import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'
import { HDate } from '@hebcal/core'
import { MONTH_HE, hebrewYearStr, getShabbatOrHolidayLabel } from '@/lib/hebrewDate'

function getWeekSunday(dateStr: string): string {
  const d = new Date(dateStr)
  const dow = d.getDay()
  d.setDate(d.getDate() - dow)
  return d.toISOString().split('T')[0]
}

function yearToGematriya(year: number): string {
  const GEMATRIA_HUNDREDS: Record<number, string> = { 1:'ק', 2:'ר', 3:'ש', 4:'ת' }
  const GEMATRIA_TENS: Record<number, string> = { 1:'י', 2:'כ', 3:'ל', 4:'מ', 5:'נ', 6:'ס', 7:'ע', 8:'פ', 9:'צ' }
  const GEMATRIA_ONES: Record<number, string> = { 1:'א', 2:'ב', 3:'ג', 4:'ד', 5:'ה', 6:'ו', 7:'ז', 8:'ח', 9:'ט' }
  const shortYear = year % 1000
  const h = Math.floor(shortYear / 100)
  const t = Math.floor((shortYear % 100) / 10)
  const o = shortYear % 10
  let result = ''
  if (h >= 4) {
    const fours = Math.floor(h / 4)
    const remainder = h % 4
    for (let i = 0; i < fours; i++) result += 'ת'
    if (remainder > 0) result += GEMATRIA_HUNDREDS[remainder]
  } else if (h > 0) { result += GEMATRIA_HUNDREDS[h] }
  if (t === 1 && o === 5) { result += 'טו' }
  else if (t === 1 && o === 6) { result += 'טז' }
  else { if (t > 0) result += GEMATRIA_TENS[t]; if (o > 0) result += GEMATRIA_ONES[o] }
  if (result.length === 1) result += '׳'
  else if (result.length > 1) result = result.slice(0, -1) + '״' + result.slice(-1)
  return result
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    const { date_from, date_to, member_ids, hebrew_year } = await req.json()

    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })
    }

    // Period label from Hebrew year or date range
    const periodLabel = hebrew_year
      ? `שנת ${yearToGematriya(hebrew_year)}`
      : (() => {
          const hd = new HDate(new Date(date_from))
          return `${MONTH_HE[hd.getMonth()] ?? ''} ${hebrewYearStr(hd)}`
        })()

    // Get members
    let membersQuery = supabase.from('members').select('id, name, email').eq('active', 1)
    if (member_ids && member_ids.length > 0) {
      membersQuery = membersQuery.in('id', member_ids)
    }
    const { data: members } = await membersQuery
    if (!members || members.length === 0) {
      return NextResponse.json({ count: 0, invoices: [] })
    }

    const memberIds = members.map((m: { id: number }) => m.id)

    // Get all charges in range for these members (includes monthly membership fees)
    const { data: allCharges } = await supabase
      .from('member_charges')
      .select('*')
      .gte('date', date_from)
      .lte('date', date_to)
      .in('member_id', memberIds)

    // Get all purchase transactions with member_id in range
    const { data: allPurchases } = await supabase
      .from('transactions')
      .select('*, categories(name_he)')
      .eq('type', 'expense')
      .gte('date', date_from)
      .lte('date', date_to)
      .in('member_id', memberIds)

    // Also get purchase-type transactions (type=purchase) in range
    const { data: allPurchaseType } = await supabase
      .from('transactions')
      .select('*, categories(name_he)')
      .eq('type', 'purchase')
      .gte('date', date_from)
      .lte('date', date_to)

    // Build a map: purchases keyed by notes containing member name (for non-member-linked purchases)
    const allPurchaseTxns = [...(allPurchases ?? []), ...(allPurchaseType ?? [])]

    const createdInvoices = []

    for (const member of members as { id: number; name: string; email: string | null }[]) {
      const memberCharges = (allCharges ?? []).filter(
        (c: { member_id: number }) => c.member_id === member.id
      )
      // Purchases linked by member_id OR by notes containing member name
      const memberPurchases = allPurchaseTxns.filter(
        (p: { member_id: number | null; notes: string | null }) =>
          p.member_id === member.id ||
          (p.notes && p.notes.includes(member.name))
      )

      if (memberCharges.length === 0 && memberPurchases.length === 0) continue

      const invoiceTitle = `חשבון - ${member.name} - ${periodLabel}`
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          date: todayStr,
          title_he: invoiceTitle,
          title_en: `Statement - ${member.name}`,
          member_id: member.id,
          status: 'sent',
          notes: `תקופה: ${periodLabel}`,
          created_by: userId,
        })
        .select()
        .single()

      if (invError || !invoice) continue

      // Monthly fees / charges → period is the month description
      const chargeItems = memberCharges.map((charge: { description: string; amount: number; date: string }) => {
        // Extract period from charge description (e.g., "דמי חבר - כסלו תשפ״ו" → "כסלו תשפ״ו")
        const parts = charge.description.split(' - ')
        const period = parts.length > 1 ? parts.slice(1).join(' - ') : ''
        const itemName = parts[0] || charge.description
        return {
          invoice_id: (invoice as { id: number }).id,
          description_he: itemName,
          description_en: itemName,
          period: period,
          quantity: 1,
          unit_price: Number(charge.amount),
          amount: Number(charge.amount),
        }
      })

      // Purchases → period is the week/parasha label
      const purchaseItems = memberPurchases.map((p: { description_he: string | null; amount: number; date: string; categories?: { name_he: string } | null }) => {
        const sundayStr = getWeekSunday(p.date)
        const weekLabel = getShabbatOrHolidayLabel(sundayStr, 'he')
        const baseName = p.categories?.name_he ?? (p.description_he ?? 'רכישה')
        return {
          invoice_id: (invoice as { id: number }).id,
          description_he: baseName,
          description_en: baseName,
          period: weekLabel || '',
          quantity: 1,
          unit_price: Number(p.amount),
          amount: Number(p.amount),
        }
      })

      const allItems = [...chargeItems, ...purchaseItems]
      if (allItems.length > 0) {
        await supabase.from('invoice_items').insert(allItems)
      }

      const total = allItems.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
      createdInvoices.push({
        id: (invoice as { id: number }).id,
        member: member.name,
        email: member.email,
        total,
      })
    }

    return NextResponse.json({ count: createdInvoices.length, invoices: createdInvoices })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
