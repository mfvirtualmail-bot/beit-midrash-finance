import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HDate } from '@hebcal/core'

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function nextOccurrences(rec: {
  frequency: string
  start_date: string
  end_date?: string | null
  last_generated?: string | null
  day_of_month?: number | null
  hebrew_day?: number | null
  hebrew_month?: number | null
}): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = new Date(rec.last_generated ?? rec.start_date)
  from.setHours(0, 0, 0, 0)
  const endDate = rec.end_date ? new Date(rec.end_date) : null
  const dates: string[] = []

  if (rec.frequency === 'monthly') {
    const dayOfMonth = rec.day_of_month ?? 1
    let d = new Date(from.getFullYear(), from.getMonth(), dayOfMonth)
    if (d <= from) d = new Date(d.getFullYear(), d.getMonth() + 1, dayOfMonth)
    while (d <= today && (!endDate || d <= endDate)) {
      dates.push(toDateStr(d))
      d = addMonths(d, 1)
      d.setDate(dayOfMonth)
    }
  } else if (rec.frequency === 'weekly') {
    let d = new Date(from)
    d.setDate(d.getDate() + 7)
    while (d <= today && (!endDate || d <= endDate)) {
      dates.push(toDateStr(d))
      d.setDate(d.getDate() + 7)
    }
  } else if (rec.frequency === 'yearly') {
    let year = from.getFullYear()
    if (rec.hebrew_month && rec.hebrew_day) {
      // Hebrew yearly: find the next occurrence by Hebrew date
      let hebrewYear = new HDate(from).getFullYear()
      while (true) {
        try {
          const hd = new HDate(rec.hebrew_day, rec.hebrew_month, hebrewYear)
          const greg = hd.greg()
          if (greg > from && greg <= today && (!endDate || greg <= endDate)) {
            dates.push(toDateStr(greg))
          }
          if (greg > today) break
          hebrewYear++
        } catch { break }
      }
    } else {
      const month = rec.day_of_month ? Math.floor(rec.day_of_month / 100) : from.getMonth() + 1
      const day = rec.day_of_month ? rec.day_of_month % 100 : from.getDate()
      let d = new Date(year, month - 1, day)
      if (d <= from) { year++; d = new Date(year, month - 1, day) }
      while (d <= today && (!endDate || d <= endDate)) {
        dates.push(toDateStr(d))
        year++
        d = new Date(year, month - 1, day)
      }
    }
  } else if (rec.frequency === 'hebrew_monthly') {
    const hebrewDay = rec.hebrew_day ?? 1
    let hd = new HDate(from)
    let hebrewMonth = hd.getMonth()
    let hebrewYear = hd.getFullYear()
    // Move to next month
    hebrewMonth++
    if (hebrewMonth > 13) { hebrewMonth = 1; hebrewYear++ }
    for (let i = 0; i < 48; i++) { // max 4 years
      try {
        const next = new HDate(hebrewDay, hebrewMonth, hebrewYear)
        const greg = next.greg()
        if (greg <= today && (!endDate || greg <= endDate)) {
          dates.push(toDateStr(greg))
        }
        if (greg > today) break
        hebrewMonth++
        if (hebrewMonth > (HDate.isLeapYear(hebrewYear) ? 13 : 12)) { hebrewMonth = 1; hebrewYear++ }
      } catch { break }
    }
  }

  return dates
}

export async function POST(_req: NextRequest) {
  try {
    const { data: recurrings } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('active', true)

    let generated = 0
    for (const rec of recurrings ?? []) {
      const dates = nextOccurrences(rec)
      if (dates.length === 0) continue
      const rows = dates.map((date: string) => ({
        type: rec.type,
        amount: rec.amount,
        description_he: rec.name_he,
        description_en: rec.name_en || null,
        category_id: rec.category_id || null,
        date,
        notes: rec.notes || null,
      }))
      await supabase.from('transactions').insert(rows)
      await supabase.from('recurring_transactions')
        .update({ last_generated: dates[dates.length - 1] })
        .eq('id', rec.id)
      generated += dates.length
    }

    return NextResponse.json({ generated })
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
