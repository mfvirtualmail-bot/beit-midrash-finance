import { HDate, months, HebrewCalendar, CalOptions } from '@hebcal/core'

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
  months.SHEVAT, months.ADAR_I, months.ADAR_II,
  months.NISAN, months.IYYAR, months.SIVAN, months.TAMUZ,
  months.AV, months.ELUL,
]

const MONTH_HE: Record<number, string> = {
  [months.TISHREI]: 'תשרי',
  [months.CHESHVAN]: 'חשוון',
  [months.KISLEV]: 'כסלו',
  [months.TEVET]: 'טבת',
  [months.SHEVAT]: 'שבט',
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
  [months.SHEVAT]: 'Shevat',
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
    const yearStr = hd.renderGematriya ? hd.renderGematriya().split(' ').pop() ?? String(hd.getFullYear()) : String(hd.getFullYear())
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

export { MONTH_HE, MONTH_EN, MONTH_ORDER }
