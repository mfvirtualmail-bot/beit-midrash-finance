import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getShabbatOrHolidayLabel, getCurrentHebrewYear, hebrewYearToGregorianRange, HEBREW_CALENDAR_ORDER } from '@/lib/hebrewDate'

// Returns a list of distinct labels currently in use (parsed from transactions)
// plus all parashiot/holidays for the current + previous Hebrew year.
export async function GET() {
  try {
    const labels = new Set<string>()

    // Seed with canonical calendar entries (parashiot + holidays + month names)
    for (const entry of HEBREW_CALENDAR_ORDER) labels.add(entry)

    // Add all Shabbat/holiday labels for current + prev Hebrew year
    const year = getCurrentHebrewYear()
    for (const y of [year - 1, year]) {
      const { start, end } = hebrewYearToGregorianRange(y)
      const startD = new Date(start)
      const endD = new Date(end)
      // iterate week by week (Sundays)
      const d = new Date(startD)
      // move to nearest Sunday
      while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
      while (d <= endD) {
        const iso = d.toISOString().split('T')[0]
        const label = getShabbatOrHolidayLabel(iso, 'he')
        if (label) labels.add(label)
        d.setDate(d.getDate() + 7)
      }
    }

    // Harvest period prefixes from existing purchase descriptions (description_he = "PERIOD - ITEM")
    const { data: txs } = await supabase
      .from('transactions')
      .select('description_he')
      .eq('type', 'purchase')
    for (const t of txs ?? []) {
      const desc = (t as { description_he?: string }).description_he
      if (!desc) continue
      const idx = desc.indexOf(' - ')
      const period = idx >= 0 ? desc.slice(0, idx).trim() : desc.trim()
      if (period) labels.add(period)
    }

    return NextResponse.json(Array.from(labels).sort())
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
