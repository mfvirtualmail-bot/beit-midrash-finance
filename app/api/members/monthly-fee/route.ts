import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HDate } from '@hebcal/core'
import { MONTH_HE, hebrewYearStr } from '@/lib/hebrewDate'

// GET: preview how many members will be charged this Hebrew month
export async function GET() {
  try {
    const hd = new HDate(new Date())
    const monthNum = hd.getMonth()
    const yearNum = hd.getFullYear()
    const monthHe = MONTH_HE[monthNum] ?? ''
    const yearHe = hebrewYearStr(hd)
    const feeDesc = `דמי חבר - ${monthHe} ${yearHe}`

    const { data: members } = await supabase.from('members').select('id').eq('active', 1)
    const memberIds = (members ?? []).map((m: { id: number }) => m.id)

    let alreadyCharged = 0
    if (memberIds.length > 0) {
      const { data: existing } = await supabase
        .from('member_charges')
        .select('member_id')
        .eq('description', feeDesc)
        .in('member_id', memberIds)
      alreadyCharged = existing?.length ?? 0
    }

    return NextResponse.json({
      monthHe,
      yearHe,
      feeDesc,
      totalMembers: memberIds.length,
      toCharge: memberIds.length - alreadyCharged,
      alreadyCharged,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST: charge all (uncharged) active members for the current Hebrew month
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount) || 20

    const hd = new HDate(new Date())
    const monthNum = hd.getMonth()
    const yearNum = hd.getFullYear()
    const monthHe = MONTH_HE[monthNum] ?? ''
    const yearHe = hebrewYearStr(hd)
    const feeDesc = `דמי חבר - ${monthHe} ${yearHe}`

    const { data: members } = await supabase.from('members').select('id').eq('active', 1)
    if (!members || members.length === 0) {
      return NextResponse.json({ count: 0, monthHe, yearHe })
    }

    const memberIds = members.map((m: { id: number }) => m.id)
    const { data: existing } = await supabase
      .from('member_charges')
      .select('member_id')
      .eq('description', feeDesc)
      .in('member_id', memberIds)

    const existingIds = new Set((existing ?? []).map((e: { member_id: number }) => e.member_id))
    const toCharge = members.filter((m: { id: number }) => !existingIds.has(m.id))

    if (toCharge.length === 0) {
      return NextResponse.json({ count: 0, monthHe, yearHe, alreadyDone: true })
    }

    // First of the Hebrew month in Gregorian
    const firstOfMonth = new HDate(1, monthNum, yearNum).greg()
    const dateStr = firstOfMonth.toISOString().split('T')[0]

    const charges = toCharge.map((m: { id: number }) => ({
      member_id: m.id,
      description: feeDesc,
      amount,
      date: dateStr,
      notes: null,
    }))

    const { error } = await supabase.from('member_charges').insert(charges)
    if (error) throw error

    return NextResponse.json({
      count: toCharge.length,
      monthHe,
      yearHe,
      skipped: existingIds.size,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
