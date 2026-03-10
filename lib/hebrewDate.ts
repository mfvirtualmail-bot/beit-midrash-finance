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

function yearToGematriya(year: number): string {
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
    const yearStr = yearToGematriya(hd.getFullYear())
    if (lang === 'he') {
      return `${day} ${MONTH_HE[monthNum] ?? ''} ${yearStr}`
    }
    return `${hd.getDate()} ${MONTH_EN[monthNum] ?? ''} ${hd.getFullYear()}`
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
  return {
    month: hd.getMonth(),
    year: hd.getFullYear(),
    monthHe: MONTH_HE[hd.getMonth()] ?? '',
    monthEn: MONTH_EN[hd.getMonth()] ?? '',
  }
}

// List of Hebrew months in a given Hebrew year
export function getHebrewMonthsInYear(hebrewYear: number): Array<{ month: number; nameHe: string; nameEn: string }> {
  const isLeap = HDate.isLeapYear(hebrewYear)
  return MONTH_ORDER
    .filter(m => {
      if (m === months.ADAR_I) return isLeap
      if (m === months.ADAR_II) return isLeap
      return true
    })
    .map(m => ({ month: m, nameHe: MONTH_HE[m] ?? '', nameEn: MONTH_EN[m] ?? '' }))
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

export { MONTH_HE, MONTH_EN, MONTH_ORDER }
