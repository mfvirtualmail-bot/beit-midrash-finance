import { HDate, months, HebrewCalendar, CalOptions, flags } from '@hebcal/core'

// Strip nikud (Hebrew vowel marks) from a string
export function stripNikud(str: string): string {
  return str.replace(/[\u0591-\u05C7]/g, '')
}

export const HEBREW_MONTHS_HE = [
  'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר א׳', 'אדר ב׳',
  'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול',
]

export const HEBREW_MONTHS_EN = [
  'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar',
  'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
]

// Month numbers (Hebcal uses these constants)
const MONTH_ORDER = [
  months.TISHREI, months.CHESHVAN, months.KISLEV, months.TEVET,
  months.SHVAT, months.ADAR_I, months.ADAR_II,
  months.NISAN, months.IYYAR, months.SIVAN, months.TAMUZ,
  months.AV, months.ELUL,
]

const MONTH_HE: Record<number, string> = {
  [months.TISHREI]: 'תשרי',
  [months.CHESHVAN]: 'חשוון',
  [months.KISLEV]: 'כסלו',
  [months.TEVET]: 'טבת',
  [months.SHVAT]: 'שבט',
  [months.ADAR_I]: 'אדר א׳',
  [months.ADAR_II]: 'אדר ב׳',
  [months.NISAN]: 'ניסן',
  [months.IYYAR]: 'אייר',
  [months.SIVAN]: 'סיוון',
  [months.TAMUZ]: 'תמוז',
  [months.AV]: 'אב',
  [months.ELUL]: 'אלול',
}

const MONTH_EN: Record<number, string> = {
  [months.TISHREI]: 'Tishrei',
  [months.CHESHVAN]: 'Cheshvan',
  [months.KISLEV]: 'Kislev',
  [months.TEVET]: 'Tevet',
  [months.SHVAT]: 'Shevat',
  [months.ADAR_I]: 'Adar I',
  [months.ADAR_II]: 'Adar II',
  [months.NISAN]: 'Nisan',
  [months.IYYAR]: 'Iyar',
  [months.SIVAN]: 'Sivan',
  [months.TAMUZ]: 'Tammuz',
  [months.AV]: 'Av',
  [months.ELUL]: 'Elul',
}

/**
 * Get the correct Hebrew month name, taking leap years into account.
 * In a non-leap year, ADAR_I is just "אדר" (not "אדר א׳").
 * In a leap year, ADAR_I = "אדר א׳", ADAR_II = "אדר ב׳".
 */
export function getMonthNameHe(monthNum: number, hebrewYear: number): string {
  if (monthNum === months.ADAR_I && !HDate.isLeapYear(hebrewYear)) {
    return 'אדר'
  }
  return MONTH_HE[monthNum] ?? ''
}

export function getMonthNameEn(monthNum: number, hebrewYear: number): string {
  if (monthNum === months.ADAR_I && !HDate.isLeapYear(hebrewYear)) {
    return 'Adar'
  }
  return MONTH_EN[monthNum] ?? ''
}

const HEBREW_DIGITS: Record<number, string> = {
  1:'א', 2:'ב', 3:'ג', 4:'ד', 5:'ה', 6:'ו', 7:'ז', 8:'ח', 9:'ט',
  10:'י', 11:'יא', 12:'יב', 13:'יג', 14:'יד', 15:'טו', 16:'טז',
  17:'יז', 18:'יח', 19:'יט', 20:'כ', 21:'כא', 22:'כב', 23:'כג',
  24:'כד', 25:'כה', 26:'כו', 27:'כז', 28:'כח', 29:'כט', 30:'ל',
}

// Proper Hebrew year gematria (omits the thousands, e.g., 5786 → תשפ״ו)
const GEMATRIA_HUNDREDS: Record<number, string> = { 1:'ק', 2:'ר', 3:'ש', 4:'ת' }
const GEMATRIA_TENS: Record<number, string> = { 1:'י', 2:'כ', 3:'ל', 4:'מ', 5:'נ', 6:'ס', 7:'ע', 8:'פ', 9:'צ' }
const GEMATRIA_ONES: Record<number, string> = { 1:'א', 2:'ב', 3:'ג', 4:'ד', 5:'ה', 6:'ו', 7:'ז', 8:'ח', 9:'ט' }

export function yearToGematriya(year: number): string {
  // Remove thousands (5786 → 786)
  const shortYear = year % 1000
  const h = Math.floor(shortYear / 100)
  const t = Math.floor((shortYear % 100) / 10)
  const o = shortYear % 10

  let result = ''
  // Handle 400+ (ת can repeat: 500=תק, 600=תר, 700=תש, 800=תת)
  if (h >= 4) {
    const fours = Math.floor(h / 4)
    const remainder = h % 4
    for (let i = 0; i < fours; i++) result += 'ת'
    if (remainder > 0) result += GEMATRIA_HUNDREDS[remainder]
  } else if (h > 0) {
    result += GEMATRIA_HUNDREDS[h]
  }

  // Special cases: 15 = טו, 16 = טז
  if (t === 1 && o === 5) {
    result += 'טו'
  } else if (t === 1 && o === 6) {
    result += 'טז'
  } else {
    if (t > 0) result += GEMATRIA_TENS[t]
    if (o > 0) result += GEMATRIA_ONES[o]
  }

  // Add geresh/gershayim
  if (result.length === 1) {
    result += '׳'
  } else if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1)
  }

  return result
}

// Convert YYYY-MM-DD to HDate
export function toHDate(gregorianDateStr: string): HDate {
  const [y, m, d] = gregorianDateStr.split('-').map(Number)
  return new HDate(new Date(y, m - 1, d))
}

// Full Hebrew date string: "כ״ב בתשרי תשפ״ה"
export function formatHebrewDate(gregorianDateStr: string, lang: 'he' | 'en' = 'he'): string {
  try {
    const hd = toHDate(gregorianDateStr)
    const day = HEBREW_DIGITS[hd.getDate()] ?? String(hd.getDate())
    const monthNum = hd.getMonth()
    const hebrewYear = hd.getFullYear()
    const yearStr = yearToGematriya(hebrewYear)
    if (lang === 'he') {
      return `${day} ${getMonthNameHe(monthNum, hebrewYear)} ${yearStr}`
    }
    return `${hd.getDate()} ${getMonthNameEn(monthNum, hebrewYear)} ${hebrewYear}`
  } catch {
    return gregorianDateStr
  }
}

// Get current Hebrew year
export function getCurrentHebrewYear(): number {
  return new HDate(new Date()).getFullYear()
}

// Get Hebrew month and year for a given gregorian YYYY-MM string
export function getHebrewMonthYear(gregorianDateStr: string): { month: number; year: number; monthHe: string; monthEn: string } {
  const hd = toHDate(gregorianDateStr + '-01')
  const hebrewYear = hd.getFullYear()
  return {
    month: hd.getMonth(),
    year: hebrewYear,
    monthHe: getMonthNameHe(hd.getMonth(), hebrewYear),
    monthEn: getMonthNameEn(hd.getMonth(), hebrewYear),
  }
}

// List of Hebrew months in a given Hebrew year
export function getHebrewMonthsInYear(hebrewYear: number): Array<{ month: number; nameHe: string; nameEn: string }> {
  const isLeap = HDate.isLeapYear(hebrewYear)
  return MONTH_ORDER
    .filter(m => {
      // In non-leap year: include ADAR_I (as plain Adar), exclude ADAR_II
      // In leap year: include both ADAR_I and ADAR_II
      if (m === months.ADAR_II) return isLeap
      return true
    })
    .map(m => ({ month: m, nameHe: getMonthNameHe(m, hebrewYear), nameEn: getMonthNameEn(m, hebrewYear) }))
}

// Get the Gregorian date range for a Hebrew month/year
export function hebrewMonthToGregorianRange(hebrewMonth: number, hebrewYear: number): { start: string; end: string } {
  const start = new HDate(1, hebrewMonth, hebrewYear)
  const daysInMonth = HDate.daysInMonth(hebrewMonth, hebrewYear)
  const end = new HDate(daysInMonth, hebrewMonth, hebrewYear)
  const startG = start.greg()
  const endG = end.greg()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(startG), end: fmt(endG) }
}

// Get the Hebrew year as gematria string (e.g. "תשפ״ה")
export function hebrewYearStr(hd: HDate): string {
  return yearToGematriya(hd.getFullYear())
}

// Get Shabbat parasha name or Holiday name for the week containing sundayDateStr
export function getShabbatOrHolidayLabel(sundayDateStr: string, lang: 'he' | 'en' = 'he'): string {
  try {
    const [y, m, d] = sundayDateStr.split('-').map(Number)
    const saturday = new Date(y, m - 1, d + 6)

    const events = HebrewCalendar.calendar({
      start: saturday,
      end: saturday,
      sedrot: true,
      il: true,
      noHolidays: false,
    } as CalOptions)

    // Yom Tov takes priority
    const chag = events.find(e => e.getFlags() & flags.CHAG)
    if (chag) {
      const raw = lang === 'he' ? (chag.renderBrief?.('he') ?? chag.render('he')) : (chag.renderBrief?.('en') ?? chag.render('en'))
      return stripNikud(raw)
    }

    // Special Shabbat (HaGadol, Shuva, etc.)
    const special = events.find(e => e.getFlags() & flags.SPECIAL_SHABBAT)
    const parasha = events.find(e => e.getFlags() & flags.PARSHA_HASHAVUA)

    if (parasha && special) {
      const pName = stripNikud(parasha.render?.(lang === 'he' ? 'he' : 'en') ?? '')
      const sName = stripNikud(special.render?.(lang === 'he' ? 'he' : 'en') ?? '')
      return `${pName} (${sName})`
    }
    if (parasha) return stripNikud(parasha.render?.(lang === 'he' ? 'he' : 'en') ?? (lang === 'he' ? 'שבת' : 'Shabbat'))
    if (special) return stripNikud(special.render?.(lang === 'he' ? 'he' : 'en') ?? (lang === 'he' ? 'שבת' : 'Shabbat'))

    return lang === 'he' ? 'שבת' : 'Shabbat'
  } catch {
    return lang === 'he' ? 'שבת' : 'Shabbat'
  }
}

// A single holiday day that can be used as a purchase period.
export interface HolidayPeriod {
  dateStr: string   // YYYY-MM-DD (gregorian date of that holiday day)
  nameHe: string    // e.g. "פסח א׳" (nikud stripped)
  nameEn: string    // e.g. "Pesach I"
}

/**
 * Get every individual Yom Tov / major holiday day whose gregorian date falls
 * inside the gregorian range of the given Hebrew month.
 *
 * Each holiday day is a separate entry (e.g. Pesach day 1, day 2, chol hamoed
 * days, 7th day, 8th day are all separate). Uses diaspora observance
 * (il: false) so that chutz-la'aretz-only days (יום ב פסח, אחרון של פסח,
 * יום ב שבועות, שמחת תורה) are included.
 */
export function getHolidayPeriodsForMonth(hebrewMonth: number, hebrewYear: number): HolidayPeriod[] {
  try {
    const range = hebrewMonthToGregorianRange(hebrewMonth, hebrewYear)
    const [sy, sm, sd] = range.start.split('-').map(Number)
    const [ey, em, ed] = range.end.split('-').map(Number)
    const start = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)

    const events = HebrewCalendar.calendar({
      start, end,
      sedrot: false,
      il: false,
      noHolidays: false,
    } as CalOptions)

    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    // Include: Yom Tov, Chol HaMoed, major fasts, minor holidays, Chanukah.
    // Exclude: Rosh Chodesh, candle-lighting-only markers, havdalah, parasha.
    // Flag names taken from @hebcal/core's `flags` enum.
    const fAny = flags as unknown as Record<string, number>
    const INCLUDE_MASK =
      (fAny.CHAG ?? 0) |
      (fAny.CHOL_HAMOED ?? 0) |
      (fAny.MAJOR_FAST ?? 0) |
      (fAny.MINOR_HOLIDAY ?? 0) |
      (fAny.CHANUKAH_CANDLES ?? 0)
    const EREV_FLAG = fAny.EREV ?? 0

    const seen = new Set<string>()
    const results: HolidayPeriod[] = []

    for (const e of events) {
      const f = e.getFlags()
      if (!(f & INCLUDE_MASK)) continue
      // Skip "Erev X" markers (e.g. Erev Purim) — they duplicate the actual
      // holiday and are not separate purchase periods.
      if (f & EREV_FLAG) continue

      const d = e.getDate().greg()
      const dateStr = fmt(d)
      const nameHe = stripNikud(e.renderBrief?.('he') ?? e.render('he') ?? '').trim()
      const nameEn = stripNikud(e.renderBrief?.('en') ?? e.render('en') ?? '').trim()
      if (!nameHe && !nameEn) continue

      const key = dateStr + '|' + nameHe
      if (seen.has(key)) continue
      seen.add(key)

      results.push({ dateStr, nameHe, nameEn })
    }

    results.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
    return results
  } catch {
    return []
  }
}

// Get Gregorian date range for an entire Hebrew year (Tishrei 1 → Elul end)
export function hebrewYearToGregorianRange(hebrewYear: number): { start: string; end: string } {
  const startHd = new HDate(1, months.TISHREI, hebrewYear)
  const endHd = new HDate(HDate.daysInMonth(months.ELUL, hebrewYear), months.ELUL, hebrewYear)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(startHd.greg()), end: fmt(endHd.greg()) }
}

// Get recent Hebrew years for selectors (current + previous 2)
export function getRecentHebrewYears(): Array<{ year: number; label: string }> {
  const current = getCurrentHebrewYear()
  const years = []
  for (let y = current - 2; y <= current + 1; y++) {
    years.push({ year: y, label: yearToGematriya(y) })
  }
  return years
}

// === Hebrew Calendar Period Ordering ===
// This defines the canonical order of periods in a Hebrew year.
// Used to sort statement lines in proper Hebrew calendar sequence.
// Can be extended with additional items — they will be sorted in the order listed here.
export const HEBREW_CALENDAR_ORDER: string[] = [
  // תשרי (Tishrei)
  'תשרי',
  'ראש השנה',
  'פרשת וילך',       // שבת שובה — between R"H and Yom Kippur
  'צום גדליה',
  'שבת שובה',
  'יום כיפור',
  'פרשת האזינו',     // Shabbat between Yom Kippur and Sukkot
  'סוכות',
  'הושענא רבה',
  'שמחת תורה',
  'שמיני עצרת',
  'פרשת בראשית',
  // חשוון (Cheshvan)
  'חשוון',
  'פרשת נח',
  'פרשת לך לך',
  'פרשת וירא',
  'פרשת חיי שרה',
  // כסלו (Kislev)
  'כסלו',
  'פרשת תולדות',
  'פרשת ויצא',
  'פרשת וישלח',
  'פרשת וישב',
  'חנוכה',
  // טבת (Tevet)
  'טבת',
  'פרשת מקץ',
  'פרשת ויגש',
  'פרשת ויחי',
  'עשרה בטבת',
  // שבט (Shevat)
  'שבט',
  'פרשת שמות',
  'פרשת וארא',
  'פרשת בא',
  'פרשת בשלח',
  'ט"ו בשבט',
  'פרשת יתרו',
  'פרשת משפטים',
  // אדר (Adar)
  'אדר',
  'אדר א׳',
  'אדר ב׳',
  'פרשת תרומה',
  'פרשת תצוה',
  'תענית אסתר',
  'פורים',
  'פרשת כי תשא',
  'פרשת ויקהל',
  'פרשת פקודי',
  // ניסן (Nissan)
  'ניסן',
  'פרשת ויקרא',
  'פרשת צו',
  'פסח',
  'פרשת שמיני',
  // אייר (Iyar)
  'אייר',
  'פרשת תזריע',
  'פרשת מצורע',
  'פרשת אחרי מות',
  'פרשת קדושים',
  'ל"ג בעומר',
  // סיוון (Sivan)
  'סיוון',
  'פרשת אמור',
  'פרשת בהר',
  'פרשת בחוקותי',
  'שבועות',
  'פרשת במדבר',
  // תמוז (Tammuz)
  'תמוז',
  'פרשת נשא',
  'פרשת בהעלותך',
  'פרשת שלח',
  'פרשת קרח',
  'י"ז בתמוז',
  // אב (Av)
  'אב',
  'פרשת חקת',
  'פרשת בלק',
  'פרשת פינחס',
  'פרשת מטות',
  'פרשת מסעי',
  'תשעה באב',
  'פרשת דברים',
  // אלול (Elul)
  'אלול',
  'פרשת ואתחנן',
  'פרשת עקב',
  'פרשת ראה',
  'פרשת שופטים',
  'פרשת כי תצא',
  'פרשת כי תבוא',
  'פרשת נצבים',
]

// Map Hebrew month names to their starting index in HEBREW_CALENDAR_ORDER
const MONTH_TO_ORDER_INDEX: Record<string, number> = {}
const MONTH_NAMES_IN_ORDER = [
  'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר א׳', 'אדר ב׳',
  'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול',
]
for (const name of MONTH_NAMES_IN_ORDER) {
  const idx = HEBREW_CALENDAR_ORDER.indexOf(name)
  if (idx >= 0) MONTH_TO_ORDER_INDEX[name] = idx
}

/**
 * Get the sort index for a Hebrew period string.
 * Returns a number for sorting statement lines in Hebrew calendar order.
 * Lower = earlier in the year (Tishrei first, Elul last).
 */
export function getHebrewPeriodSortIndex(period: string): number {
  if (!period) return 9999

  // Try exact match first
  const exactIdx = HEBREW_CALENDAR_ORDER.indexOf(period)
  if (exactIdx >= 0) return exactIdx

  // Try to find a match (period may include year, e.g. "תשרי תשפ״ו")
  // Or may have combined parshiot like "פרשת ויקהלפקודי"
  for (let i = 0; i < HEBREW_CALENDAR_ORDER.length; i++) {
    const entry = HEBREW_CALENDAR_ORDER[i]
    if (period.includes(entry) || entry.includes(period)) return i
    // Handle "Parashat X" without the "פרשת " prefix
    if (entry.startsWith('פרשת ') && period.includes(entry.slice(5))) return i
  }

  // Try to match combined parshiot (e.g. "פרשת ויקהלפקודי" → "פרשת ויקהל")
  for (let i = 0; i < HEBREW_CALENDAR_ORDER.length; i++) {
    const entry = HEBREW_CALENDAR_ORDER[i]
    if (entry.startsWith('פרשת ')) {
      const parashaName = entry.slice(5) // Remove "פרשת "
      if (period.includes(parashaName)) return i
    }
  }

  // Try to find the Hebrew month from the period text
  for (const monthName of MONTH_NAMES_IN_ORDER) {
    if (period.includes(monthName)) {
      // Place at the month's position (membership line)
      return MONTH_TO_ORDER_INDEX[monthName] ?? 9999
    }
  }

  return 9999
}

/**
 * Get sort index for a payment by its Gregorian date.
 * Converts to Hebrew date, finds the month, returns index after
 * the last item in that month (so payments appear after charges/purchases).
 */
export function getPaymentSortIndex(gregorianDate: string): number {
  try {
    const hd = toHDate(gregorianDate)
    const monthNum = hd.getMonth()
    const monthName = getMonthNameHe(monthNum, hd.getFullYear())
    if (!monthName) return 9999

    // Find the last item index for this month
    const monthIdx = MONTH_TO_ORDER_INDEX[monthName]
    if (monthIdx === undefined) return 9999

    // Find next month's start index (or end of list)
    let nextMonthIdx = HEBREW_CALENDAR_ORDER.length
    for (const name of MONTH_NAMES_IN_ORDER) {
      const idx = MONTH_TO_ORDER_INDEX[name]
      if (idx !== undefined && idx > monthIdx) {
        nextMonthIdx = idx
        break
      }
    }

    // Place payment at end of this month's items (with 0.5 offset so it sorts after)
    return nextMonthIdx - 0.5
  } catch {
    return 9999
  }
}

export { MONTH_HE, MONTH_EN, MONTH_ORDER }

// === Label overrides ===
// Users can rename parasha/holiday/period labels via /labels.
// Overrides are applied as substring replacement at display time, so existing
// purchase descriptions (e.g. "פרשת ויקהלפקודי - כהן") get renamed automatically
// without mutating the DB records.
export type LabelOverride = { original_text: string; replacement_text: string }

export function applyLabelOverrides(text: string | null | undefined, overrides: LabelOverride[] | null | undefined): string {
  if (!text) return text ?? ''
  if (!overrides || overrides.length === 0) return text
  // Sort longest-original-first so longer matches take priority over substrings.
  const sorted = [...overrides].sort((a, b) => b.original_text.length - a.original_text.length)
  let out = text
  for (const o of sorted) {
    if (!o.original_text) continue
    // Global replace without regex (originals may contain special chars)
    out = out.split(o.original_text).join(o.replacement_text)
  }
  return out
}
