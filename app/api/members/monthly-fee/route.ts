import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HDate } from '@hebcal/core'
import { MONTH_HE, hebrewYearStr, getHebrewMonthsInYear } from '@/lib/hebrewDate'

function getMonthInfo(monthNum: number, yearNum: number) {
  const monthHe = MONTH_HE[monthNum] ?? ''
  const hd = new HDate(1, monthNum, yearNum)
  const yearHe = hebrewYearStr(hd)
  const feeDesc = `דמי חבר - ${monthHe} ${yearHe}`
  const dateStr = hd.greg().toISOString().split('T')[0]
  return { monthHe, yearHe, feeDesc, dateStr }
}

// GET: preview — accepts ?month=X&year=Y (optional, defaults to current Hebrew month)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const hd = new HDate(new Date())
    const monthNum = url.searchParams.get('month') ? Number(url.searchParams.get('month')) : hd.getMonth()
    const yearNum = url.searchParams.get('year') ? Number(url.searchParams.get('year')) : hd.getFullYear()

    const { monthHe, yearHe, feeDesc } = getMonthInfo(monthNum, yearNum)

    // Return available months (current + previous Hebrew year)
    const currentYear = hd.getFullYear()
    const prevYear = currentYear - 1
    const mkMonth = (m: { month: number; nameHe: string }, yr: number) => ({
      month: m.month, year: yr, nameHe: m.nameHe, yearHe: hebrewYearStr(new HDate(1, m.month, yr)),
    })
    const availableMonths = [
      ...getHebrewMonthsInYear(prevYear).map(m => mkMonth(m, prevYear)),
      ...getHebrewMonthsInYear(currentYear).map(m => mkMonth(m, currentYear)),
    ]

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
      selectedMonth: monthNum,
      selectedYear: yearNum,
      availableMonths,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST: charge all (uncharged) active members — accepts { amount, month, year }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount) || 20

    const hd = new HDate(new Date())
    const monthNum = body.month ? Number(body.month) : hd.getMonth()
    const yearNum = body.year ? Number(body.year) : hd.getFullYear()

    const { monthHe, yearHe, feeDesc, dateStr } = getMonthInfo(monthNum, yearNum)

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
