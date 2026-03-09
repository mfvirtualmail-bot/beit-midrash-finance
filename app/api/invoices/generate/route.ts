import { NextRequest, NextResponse } from 'next/server'
import { supabase, getSessionUser } from '@/lib/supabase'
import { COOKIE_NAME } from '@/lib/auth'
import { HDate } from '@hebcal/core'
import { MONTH_HE, hebrewYearStr } from '@/lib/hebrewDate'

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUser(req.cookies.get(COOKIE_NAME)?.value)
    const { date_from, date_to, member_ids } = await req.json()

    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })
    }

    // Get members
    let membersQuery = supabase.from('members').select('id, name, email').eq('active', 1)
    if (member_ids && member_ids.length > 0) {
      membersQuery = membersQuery.in('id', member_ids)
    }
    const { data: members } = await membersQuery
    if (!members || members.length === 0) {
      return NextResponse.json({ count: 0, invoices: [] })
    }

    // Hebrew period label
    const hd = new HDate(new Date(date_from))
    const monthHe = MONTH_HE[hd.getMonth()] ?? ''
    const yearHe = hebrewYearStr(hd)
    const periodLabel = `${monthHe} ${yearHe}`

    // Get all charges in range for these members
    const { data: allCharges } = await supabase
      .from('member_charges')
      .select('*')
      .gte('date', date_from)
      .lte('date', date_to)
      .in('member_id', members.map((m: { id: number }) => m.id))

    const createdInvoices = []

    for (const member of members as { id: number; name: string; email: string | null }[]) {
      const memberCharges = (allCharges ?? []).filter(
        (c: { member_id: number }) => c.member_id === member.id
      )
      if (memberCharges.length === 0) continue

      const invoiceTitle = `חשבון - ${member.name} - ${periodLabel}`
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          date: date_from,
          title_he: invoiceTitle,
          title_en: `Statement - ${member.name}`,
          member_id: member.id,
          status: 'sent',
          notes: `תקופה: ${date_from} — ${date_to}`,
          created_by: userId,
        })
        .select()
        .single()

      if (invError || !invoice) continue

      const items = memberCharges.map((charge: { description: string; amount: number }) => ({
        invoice_id: (invoice as { id: number }).id,
        description_he: charge.description,
        description_en: charge.description,
        quantity: 1,
        unit_price: Number(charge.amount),
        amount: Number(charge.amount),
      }))

      await supabase.from('invoice_items').insert(items)

      const total = memberCharges.reduce(
        (s: number, c: { amount: number }) => s + Number(c.amount), 0
      )
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
