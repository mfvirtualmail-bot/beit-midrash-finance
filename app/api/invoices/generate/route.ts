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

    // Get active members (active column is integer: 1=active, 0=inactive)
    let membersQuery = supabase.from('members').select('id, name, email').eq('active', 1)
    if (member_ids && member_ids.length > 0) {
      membersQuery = membersQuery.in('id', member_ids)
    }
    const { data: members } = await membersQuery
    if (!members || members.length === 0) {
      return NextResponse.json({ count: 0, invoices: [] })
    }

    const memberIds = members.map((m: { id: number }) => m.id)

    // Get all charges in range (monthly membership fees)
    const { data: allCharges } = await supabase
      .from('member_charges')
      .select('*')
      .gte('date', date_from)
      .lte('date', date_to)
      .in('member_id', memberIds)

    // Get expense transactions linked to members in range
    const { data: allExpenses } = await supabase
      .from('transactions')
      .select('*, categories(name_he)')
      .eq('type', 'expense')
      .gte('date', date_from)
      .lte('date', date_to)
      .not('member_id', 'is', null)

    // Get purchase-type transactions in range
    const { data: allPurchaseType } = await supabase
      .from('transactions')
      .select('*, categories(name_he)')
      .eq('type', 'purchase')
      .gte('date', date_from)
      .lte('date', date_to)

    const allPurchaseTxns = [...(allExpenses ?? []), ...(allPurchaseType ?? [])]

    const createdInvoices = []

    for (const member of members as { id: number; name: string; email: string | null }[]) {
      const memberCharges = (allCharges ?? []).filter(
        (c: { member_id: number }) => c.member_id === member.id
      )
      const memberPurchases = allPurchaseTxns.filter(
        (p: { member_id: number | null; notes: string | null }) =>
          p.member_id === member.id ||
          (p.notes && p.notes.includes(member.name))
      )

      if (memberCharges.length === 0 && memberPurchases.length === 0) continue

      // Build items: description_he = "period - item" so display layer can parse
      const chargeItems = memberCharges.map((charge: { description: string; amount: number }) => {
        // e.g., "דמי חבר - כסלו תשפ״ו" → period="כסלו תשפ״ו", item="דמי חבר"
        const parts = charge.description.split(' - ')
        const period = parts.length > 1 ? parts.slice(1).join(' - ') : ''
        const itemName = parts[0] || charge.description
        return {
          description_he: period ? `${period} - ${itemName}` : itemName,
          description_en: period ? `${period} - ${itemName}` : itemName,
          quantity: 1,
          unit_price: Number(charge.amount),
          amount: Number(charge.amount),
        }
      })

      const purchaseItems = memberPurchases.map((p: { description_he: string | null; amount: number; date: string; categories?: { name_he: string } | null }) => {
        // The transaction description_he already has the correct format:
        // "פרשת האזינו - שלישי", "יום כיפור - כהן", "נר למאור", etc.
        // The invoice detail page will split on " - " to get period vs item.
        // If description_he has no parasha info, compute it from the date.
        let descHe = p.description_he ?? ''
        if (!descHe) {
          // No description — use category name with computed week label
          const sundayStr = getWeekSunday(p.date)
          const weekLabel = getShabbatOrHolidayLabel(sundayStr, 'he')
          const catName = p.categories?.name_he ?? 'רכישה'
          descHe = weekLabel ? `${weekLabel} - ${catName}` : catName
        }
        return {
          description_he: descHe,
          description_en: descHe,
          quantity: 1,
          unit_price: Number(p.amount),
          amount: Number(p.amount),
        }
      })

      const allItems = [...chargeItems, ...purchaseItems]
      const total = allItems.reduce((s, i) => s + Number(i.amount), 0)

      const invoiceTitle = `דף חשבון - ${member.name} - ${periodLabel}`
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

      // Insert items WITHOUT the period column (may not exist in DB yet)
      if (allItems.length > 0) {
        const rows = allItems.map(item => ({
          invoice_id: (invoice as { id: number }).id,
          description_he: item.description_he,
          description_en: item.description_en,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        }))
        const { error: itemsErr } = await supabase.from('invoice_items').insert(rows)
        if (itemsErr) {
          console.error(`Invoice items insert error for member ${member.name}:`, itemsErr.message)
        }
      }

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
