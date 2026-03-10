'use client'
import { useState, useMemo } from 'react'
import { useLang } from '@/lib/LangContext'
import { HDate, HebrewCalendar, months, flags } from '@hebcal/core'
import type { CalOptions } from '@hebcal/core'
import { MONTH_HE, MONTH_EN, getHebrewMonthsInYear, hebrewMonthToGregorianRange, getShabbatOrHolidayLabel, stripNikud } from '@/lib/hebrewDate'
import { Calendar as CalIcon, ChevronLeft, ChevronRight, ShoppingCart, Star, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface WeekInfo {
  sundayDate: Date
  saturdayDate: Date
  sundayStr: string
  saturdayStr: string
  sundayHeb: HDate
  saturdayHeb: HDate
  parashaHe: string
  parashaEn: string
  holidays: Array<{ name: string; nameEn: string; date: Date; isChag: boolean }>
  isCurrentWeek: boolean
  days: DayInfo[]
}

interface DayInfo {
  date: Date
  dateStr: string
  hdate: HDate
  hebrewDay: number
  isToday: boolean
  isShabbat: boolean
  dayOfWeek: number
}

interface HolidayEvent {
  name: string
  nameEn: string
  date: Date
  hebrewDate: string
  isChag: boolean
  isMajor: boolean
}

const HEBREW_DIGITS: Record<number, string> = {
  1:'א', 2:'ב', 3:'ג', 4:'ד', 5:'ה', 6:'ו', 7:'ז', 8:'ח', 9:'ט',
  10:'י', 11:'יא', 12:'יב', 13:'יג', 14:'יד', 15:'טו', 16:'טז',
  17:'יז', 18:'יח', 19:'יט', 20:'כ', 21:'כא', 22:'כב', 23:'כג',
  24:'כד', 25:'כה', 26:'כו', 27:'כז', 28:'כח', 29:'כט', 30:'ל',
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getHebrewWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() - dow)
  return d
}

function getWeeksForHebrewMonth(hebrewMonth: number, hebrewYear: number): WeekInfo[] {
  const range = hebrewMonthToGregorianRange(hebrewMonth, hebrewYear)
  const startDate = new Date(range.start)
  const endDate = new Date(range.end)

  // Find the Sunday of the first week
  const firstSunday = getHebrewWeekStart(startDate)
  // Find the Saturday past the end of the month
  const lastDate = new Date(endDate)
  const lastSat = new Date(lastDate)
  lastSat.setDate(lastDate.getDate() + (6 - lastDate.getDay()))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = fmtDate(today)

  const weeks: WeekInfo[] = []
  const current = new Date(firstSunday)

  while (current <= lastSat) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(sunday.getDate() + 6)

    const sundayHeb = new HDate(sunday)
    const saturdayHeb = new HDate(saturday)

    // Get parasha
    const parashaHe = getShabbatOrHolidayLabel(fmtDate(sunday), 'he')
    const parashaEn = getShabbatOrHolidayLabel(fmtDate(sunday), 'en')

    // Get holidays for this week
    const holidays: WeekInfo['holidays'] = []
    try {
      const events = HebrewCalendar.calendar({
        start: sunday,
        end: saturday,
        il: true,
        noHolidays: false,
      } as CalOptions)
      for (const ev of events) {
        const isChag = !!(ev.getFlags() & flags.CHAG)
        const isMajor = !!(ev.getFlags() & (flags.CHAG | flags.MAJOR_FAST | flags.LIGHT_CANDLES))
        if (isChag || isMajor || (ev.getFlags() & flags.SPECIAL_SHABBAT)) {
          holidays.push({
            name: stripNikud(ev.render?.('he') ?? ev.renderBrief?.('he') ?? ''),
            nameEn: stripNikud(ev.render?.('en') ?? ev.renderBrief?.('en') ?? ''),
            date: ev.getDate().greg(),
            isChag,
          })
        }
      }
    } catch {}

    // Build days
    const days: DayInfo[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      const hd = new HDate(d)
      days.push({
        date: d,
        dateStr: fmtDate(d),
        hdate: hd,
        hebrewDay: hd.getDate(),
        isToday: fmtDate(d) === todayStr,
        isShabbat: i === 6,
        dayOfWeek: i,
      })
    }

    const currentWeekSunday = getHebrewWeekStart(today)
    const isCurrentWeek = fmtDate(sunday) === fmtDate(currentWeekSunday)

    weeks.push({
      sundayDate: sunday,
      saturdayDate: saturday,
      sundayStr: fmtDate(sunday),
      saturdayStr: fmtDate(saturday),
      sundayHeb,
      saturdayHeb,
      parashaHe,
      parashaEn,
      holidays,
      isCurrentWeek,
      days,
    })

    current.setDate(current.getDate() + 7)
  }

  return weeks
}

function getUpcomingHolidays(count: number): HolidayEvent[] {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setMonth(endDate.getMonth() + 6)

  try {
    const events = HebrewCalendar.calendar({
      start: today,
      end: endDate,
      il: true,
      noHolidays: false,
    } as CalOptions)

    const holidays: HolidayEvent[] = []
    for (const ev of events) {
      const isChag = !!(ev.getFlags() & flags.CHAG)
      const isMajorFast = !!(ev.getFlags() & flags.MAJOR_FAST)
      const isRoshChodesh = !!(ev.getFlags() & flags.ROSH_CHODESH)
      if (isChag || isMajorFast || isRoshChodesh) {
        const hd = ev.getDate()
        holidays.push({
          name: stripNikud(ev.render?.('he') ?? ''),
          nameEn: stripNikud(ev.render?.('en') ?? ''),
          date: hd.greg(),
          hebrewDate: `${HEBREW_DIGITS[hd.getDate()] ?? hd.getDate()} ${MONTH_HE[hd.getMonth()] ?? ''}`,
          isChag,
          isMajor: isChag || isMajorFast,
        })
      }
    }
    return holidays.slice(0, count)
  } catch {
    return []
  }
}

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbat']

export default function CalendarPage() {
  const { T, lang, isRTL } = useLang()

  // Current Hebrew date for initial state
  const todayHeb = new HDate(new Date())
  const [hebrewYear, setHebrewYear] = useState(todayHeb.getFullYear())
  const [hebrewMonth, setHebrewMonth] = useState(todayHeb.getMonth())

  const monthsInYear = useMemo(() => getHebrewMonthsInYear(hebrewYear), [hebrewYear])
  const currentMonthInfo = monthsInYear.find(m => m.month === hebrewMonth)
  const weeks = useMemo(() => getWeeksForHebrewMonth(hebrewMonth, hebrewYear), [hebrewMonth, hebrewYear])
  const upcomingHolidays = useMemo(() => getUpcomingHolidays(10), [])
  // Calendar always displays in Hebrew regardless of app language
  const dayNames = DAY_NAMES_HE

  function navigateMonth(dir: -1 | 1) {
    const idx = monthsInYear.findIndex(m => m.month === hebrewMonth)
    const newIdx = idx + dir
    if (newIdx >= 0 && newIdx < monthsInYear.length) {
      setHebrewMonth(monthsInYear[newIdx].month)
    } else if (dir === 1 && newIdx >= monthsInYear.length) {
      const nextYear = hebrewYear + 1
      const nextMonths = getHebrewMonthsInYear(nextYear)
      setHebrewYear(nextYear)
      setHebrewMonth(nextMonths[0].month)
    } else if (dir === -1 && newIdx < 0) {
      const prevYear = hebrewYear - 1
      const prevMonths = getHebrewMonthsInYear(prevYear)
      setHebrewYear(prevYear)
      setHebrewMonth(prevMonths[prevMonths.length - 1].month)
    }
  }

  function goToToday() {
    const hd = new HDate(new Date())
    setHebrewYear(hd.getFullYear())
    setHebrewMonth(hd.getMonth())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalIcon size={24} className="text-blue-600" />
          {T.hebrewCalendar}
        </h1>
        <button onClick={goToToday} className="btn-secondary text-sm">
          {T.today}
        </button>
      </div>

      {/* Month navigation */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateMonth(isRTL ? 1 : -1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} />
          </button>

          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">
              {currentMonthInfo?.nameHe}
            </h2>
            <p className="text-sm text-gray-500">{hebrewYear}</p>
          </div>

          <button onClick={() => navigateMonth(isRTL ? -1 : 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Month selector chips */}
        <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
          {monthsInYear.map(m => (
            <button
              key={m.month}
              onClick={() => setHebrewMonth(m.month)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${m.month === hebrewMonth
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {m.nameHe}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid - day headers */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {dayNames.map((name, i) => (
            <div key={i} className={`py-2 px-1 text-center text-xs font-semibold
              ${i === 6 ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
              {name}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week) => (
          <div key={week.sundayStr} className={`border-b border-gray-100 last:border-0
            ${week.isCurrentWeek ? 'bg-blue-50/30' : ''}`}>
            {/* Days row */}
            <div className="grid grid-cols-7">
              {week.days.map((day) => {
                // Check if this day's Hebrew month matches our selected month
                const inMonth = day.hdate.getMonth() === hebrewMonth
                return (
                  <div
                    key={day.dateStr}
                    className={`py-2 px-1 text-center border-e border-gray-50 last:border-0 min-h-[60px]
                      ${day.isToday ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset rounded-lg' : ''}
                      ${day.isShabbat ? 'bg-blue-50/50' : ''}
                      ${!inMonth ? 'opacity-40' : ''}`}
                  >
                    <div className={`text-sm font-bold ${day.isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                      {HEBREW_DIGITS[day.hebrewDay] ?? day.hebrewDay}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {day.date.getDate()}/{day.date.getMonth() + 1}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Week info bar */}
            <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {/* Parasha */}
                {week.parashaHe && (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    <BookOpen size={12} />
                    {week.parashaHe}
                  </span>
                )}
                {/* Holidays */}
                {week.holidays.map((h, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                    ${h.isChag ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-700'}`}>
                    <Star size={11} />
                    {h.name}
                  </span>
                ))}
              </div>

              {/* Quick link to purchases */}
              <Link
                href={`/purchases?week=${week.sundayStr}`}
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
              >
                <ShoppingCart size={12} />
                {T.addPurchaseForWeek}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Holidays sidebar */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Star size={18} className="text-amber-500" />
          {T.upcomingHolidays}
        </h3>
        {upcomingHolidays.length === 0 ? (
          <p className="text-gray-400 text-center py-4">{T.noHolidays}</p>
        ) : (
          <div className="space-y-2">
            {upcomingHolidays.map((h, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl
                ${h.isMajor ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                <div>
                  <span className={`font-medium text-sm ${h.isMajor ? 'text-amber-900' : 'text-gray-800'}`}>
                    {h.name}
                  </span>
                  <span className="text-xs text-gray-500 mx-2">
                    {h.hebrewDate}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {h.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
