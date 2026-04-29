'use client'
import { useEffect, useState, useRef, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Member } from '@/lib/db'
import { HDate } from '@hebcal/core'
import {
  buildHebrewMonthGrid,
  getHebrewMonthsInYear,
  yearToGematriya,
  applyLabelOverrides,
  LabelOverride,
} from '@/lib/hebrewDate'
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Calendar as CalendarIcon,
  Upload,
  Pencil,
  X,
} from 'lucide-react'
import Link from 'next/link'

// === Types ===

interface PurchaseRow {
  id: string
  item_label: string
  member_id: number | ''
  amount: string
  notes: string
}

interface TemplateItem { id?: number; label_he: string }
interface PurchaseTemplate {
  id: number
  template_key: string
  label_he: string
  items: TemplateItem[]
}

function uuid() { return Math.random().toString(36).slice(2) }
function blankRow(): PurchaseRow {
  return { id: uuid(), item_label: '', member_id: '', amount: '', notes: '' }
}
function rowFromTemplate(label: string): PurchaseRow {
  return { id: uuid(), item_label: label, member_id: '', amount: '', notes: '' }
}

const HE_DAY_NAMES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const EN_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// === Member dropdown (kept from previous version) ===

function MemberSelect({ members, value, onChange, placeholder }: {
  members: Member[]
  value: number | ''
  onChange: (v: number | '') => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = members.find(m => m.id === value)
  const filtered = members.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center justify-between gap-2 text-start text-sm">
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg w-full min-w-[200px]">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus className="input w-full text-sm py-1.5" placeholder="🔍" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button type="button" className="w-full text-start px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
              onClick={() => { onChange(''); setOpen(false); setSearch('') }}>—</button>
            {filtered.map(m => (
              <button key={m.id} type="button"
                className={`w-full text-start px-3 py-2 text-sm hover:bg-blue-50 ${value === m.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800'}`}
                onClick={() => { onChange(m.id); setOpen(false); setSearch('') }}>
                {m.name}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-4 text-sm text-gray-400 text-center">—</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// === Page ===

function PurchasesPageInner() {
  const { T, lang, isRTL } = useLang()
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<Member[]>([])
  const [templates, setTemplates] = useState<PurchaseTemplate[]>([])
  const [labelOverrides, setLabelOverrides] = useState<LabelOverride[]>([])

  // Hebrew month navigation
  const todayHeb = new HDate(new Date())
  const [hebrewYear, setHebrewYear] = useState(todayHeb.getFullYear())
  const [hebrewMonth, setHebrewMonth] = useState(todayHeb.getMonth())
  const monthsInYear = getHebrewMonthsInYear(hebrewYear)
  const currentMonthInfo = monthsInYear.find(m => m.month === hebrewMonth)

  // Build the calendar grid for the current Hebrew month
  const grid = useMemo(() => buildHebrewMonthGrid(hebrewMonth, hebrewYear), [hebrewMonth, hebrewYear])

  // Apply label overrides to parasha/holiday names
  const gridWithOverrides = useMemo(() => {
    if (labelOverrides.length === 0) return grid
    return grid.map(c => ({
      ...c,
      parashaHe: applyLabelOverrides(c.parashaHe, labelOverrides),
      holidayHe: applyLabelOverrides(c.holidayHe, labelOverrides),
      defaultLabelHe: applyLabelOverrides(c.defaultLabelHe, labelOverrides),
    }))
  }, [grid, labelOverrides])

  // Selected day
  const queryDate = searchParams?.get('date') ?? ''
  const initialDate = (() => {
    if (queryDate && grid.some(c => c.dateStr === queryDate)) return queryDate
    const today = grid.find(c => c.isToday && c.inMonth)
    if (today) return today.dateStr
    const first = grid.find(c => c.inMonth)
    return first?.dateStr ?? ''
  })()
  const [selectedDate, setSelectedDate] = useState(initialDate)

  const selectedCell = gridWithOverrides.find(c => c.dateStr === selectedDate) ?? null

  // Editable label for the selected day. Resets when day changes (unless user typed).
  const [labelEdit, setLabelEdit] = useState(selectedCell?.defaultLabelHe ?? '')
  const [labelTouched, setLabelTouched] = useState(false)
  useEffect(() => {
    if (!labelTouched) {
      setLabelEdit(selectedCell?.defaultLabelHe ?? '')
    }
  }, [selectedDate, selectedCell?.defaultLabelHe, labelTouched])

  // Item rows for the selected day. Repopulated from template when day changes
  // (unless the user has already started editing).
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [rowsTouched, setRowsTouched] = useState(false)

  const matchedTemplate = useMemo(() => {
    const key = selectedCell?.templateKey
    if (!key) return null
    const exact = templates.find(t => t.template_key === key)
    if (exact) return exact
    // Prefix match: a template "פסח" matches cell keys "פסח א'", "פסח ב'",
    // "פסח ג' (חוה'מ)" etc. Longest prefix wins.
    // Skip 'shabbat' (it's the explicit fallback key for plain Saturdays).
    const prefix = templates
      .filter(t => t.template_key && t.template_key !== 'shabbat' && key.startsWith(t.template_key))
      .sort((a, b) => b.template_key.length - a.template_key.length)[0]
    return prefix ?? null
  }, [templates, selectedCell?.templateKey])

  useEffect(() => {
    if (rowsTouched) return
    if (matchedTemplate && matchedTemplate.items.length > 0) {
      setRows(matchedTemplate.items.map(it => rowFromTemplate(it.label_he)))
    } else {
      setRows([blankRow(), blankRow(), blankRow()])
    }
  }, [selectedDate, matchedTemplate, rowsTouched])

  function selectDay(dateStr: string) {
    setSelectedDate(dateStr)
    setLabelTouched(false)
    setRowsTouched(false)
  }

  function navigateMonth(dir: -1 | 1) {
    const idx = monthsInYear.findIndex(m => m.month === hebrewMonth)
    const newIdx = idx + dir
    let newMonth = hebrewMonth
    let newYear = hebrewYear
    if (newIdx >= 0 && newIdx < monthsInYear.length) {
      newMonth = monthsInYear[newIdx].month
    } else if (dir === 1) {
      newYear = hebrewYear + 1
      newMonth = getHebrewMonthsInYear(newYear)[0].month
    } else {
      newYear = hebrewYear - 1
      const prev = getHebrewMonthsInYear(newYear)
      newMonth = prev[prev.length - 1].month
    }
    setHebrewMonth(newMonth)
    setHebrewYear(newYear)
    // Move selection to first in-month day; reset edit state
    setLabelTouched(false)
    setRowsTouched(false)
  }

  // Reload selected day when grid changes (after month nav)
  useEffect(() => {
    if (!gridWithOverrides.some(c => c.dateStr === selectedDate)) {
      const first = gridWithOverrides.find(c => c.inMonth)
      if (first) setSelectedDate(first.dateStr)
    }
  }, [gridWithOverrides, selectedDate])

  // === Saving ===
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  function updateRow(id: string, patch: Partial<PurchaseRow>) {
    setRowsTouched(true)
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }
  function addRow() {
    setRowsTouched(true)
    setRows(prev => [...prev, blankRow()])
  }
  function removeRow(id: string) {
    setRowsTouched(true)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function handleSave() {
    if (!selectedDate) return
    const periodLabel = (labelEdit || '').trim()
    const valid = rows.filter(r => r.amount && Number(r.amount) > 0 && r.item_label.trim())
    if (valid.length === 0) return
    setSaving(true)
    const txns = valid.map(r => {
      const itemLabel = r.item_label.trim()
      const descHe = periodLabel ? `${periodLabel} - ${itemLabel}` : itemLabel
      const memberName = r.member_id ? (members.find(m => m.id === r.member_id)?.name ?? '') : ''
      const notesStr = memberName
        ? `${memberName}${r.notes ? ' - ' + r.notes : ''}`
        : (r.notes || null)
      return {
        type: 'purchase',
        amount: Number(r.amount),
        description_he: descHe,
        description_en: null,
        category_id: null,
        member_id: r.member_id || null,
        date: selectedDate,
        notes: notesStr,
      }
    })
    await Promise.all(txns.map(tx =>
      fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) })
    ))
    setSaving(false)
    setSavedCount(valid.length)
    setRowsTouched(false)
    // Re-trigger the prefill effect by toggling
    setRows(matchedTemplate && matchedTemplate.items.length > 0
      ? matchedTemplate.items.map(it => rowFromTemplate(it.label_he))
      : [blankRow(), blankRow(), blankRow()])
    setTimeout(() => setSavedCount(null), 4000)
    loadExistingPurchases(selectedDate)
  }

  // === Existing purchases for selected day ===
  interface ExistingPurchase {
    id: number; amount: number; description_he: string; date: string;
    notes: string | null; member_id: number | null; member_name?: string;
  }
  const [existingPurchases, setExistingPurchases] = useState<ExistingPurchase[]>([])
  const [editPurchase, setEditPurchase] = useState<ExistingPurchase | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', notes: '' })
  const [deletePurchaseId, setDeletePurchaseId] = useState<number | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  async function loadExistingPurchases(date: string) {
    if (!date) { setExistingPurchases([]); return }
    try {
      const res = await fetch(`/api/transactions?type=purchase&limit=500`)
      const data = await res.json()
      const dayPurchases = (data as ExistingPurchase[]).filter(tx => tx.date === date && tx.member_id)
      setExistingPurchases(dayPurchases)
    } catch { setExistingPurchases([]) }
  }
  useEffect(() => { if (selectedDate) loadExistingPurchases(selectedDate) }, [selectedDate])

  function openEditPurchase(p: ExistingPurchase) {
    setEditPurchase(p)
    setEditForm({ amount: String(p.amount), notes: p.notes || '' })
  }
  async function handleEditPurchaseSave() {
    if (!editPurchase) return
    setEditSaving(true)
    await fetch(`/api/transactions/${editPurchase.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'purchase',
        amount: Number(editForm.amount),
        description_he: editPurchase.description_he,
        description_en: null,
        category_id: null,
        date: editPurchase.date,
        notes: editForm.notes || null,
      }),
    })
    setEditSaving(false)
    setEditPurchase(null)
    loadExistingPurchases(selectedDate)
  }
  async function handleDeletePurchase(id: number) {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setDeletePurchaseId(null)
    loadExistingPurchases(selectedDate)
  }

  // === Initial loads ===
  useEffect(() => {
    Promise.all([
      fetch('/api/members'),
      fetch('/api/purchase-templates'),
      fetch('/api/labels'),
    ]).then(async ([m, t, l]) => {
      setMembers(await m.json())
      const tj = await t.json()
      if (Array.isArray(tj)) setTemplates(tj)
      const lj = await l.json().catch(() => [])
      if (Array.isArray(lj)) setLabelOverrides(lj)
    })
  }, [])

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const dayNames = lang === 'he' ? HE_DAY_NAMES : EN_DAY_NAMES

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={24} className="text-orange-500" />
          {lang === 'he' ? 'הזנת רכישות' : 'Purchases Entry'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/settings/purchase-templates"
            className="flex items-center gap-2 text-sm px-3 py-2 bg-orange-50 border border-orange-300 text-orange-800 hover:bg-orange-100 rounded-xl font-medium transition-colors"
          >
            <ListChecks size={15} />
            {lang === 'he' ? 'תבניות פריטים' : 'Item Templates'}
          </Link>
          <Link
            href="/purchases/import"
            className="flex items-center gap-2 text-sm px-3 py-2 bg-green-50 border border-green-300 text-green-800 hover:bg-green-100 rounded-xl font-medium transition-colors"
          >
            <Upload size={15} />
            {lang === 'he' ? 'ייבוא מ-Excel' : 'Import from Excel'}
          </Link>
        </div>
      </div>

      {savedCount !== null && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={18} />
          <span>{lang === 'he' ? `${savedCount} רכישות נשמרו בהצלחה` : `${savedCount} purchases saved successfully`}</span>
        </div>
      )}

      {/* Hebrew month calendar — compact */}
      <div className="card !p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <button onClick={() => navigateMonth(isRTL ? 1 : -1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center" dir="rtl">
            <span className="font-bold text-gray-900 text-sm">
              {currentMonthInfo?.nameHe}
            </span>
            <span className="text-xs text-gray-500 mx-1.5">{yearToGematriya(hebrewYear)}</span>
          </div>
          <button onClick={() => navigateMonth(isRTL ? -1 : 1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Calendar grid — compact, day cells ~36px tall */}
        <div className="grid grid-cols-7 gap-0.5" dir="rtl">
          {dayNames.map((n, i) => (
            <div key={i} className="text-center font-bold text-gray-400 text-[10px] pb-0.5">{n}</div>
          ))}
          {gridWithOverrides.map(cell => {
            const isSelected = cell.dateStr === selectedDate
            const isHoliday = !!cell.holidayHe
            const label = cell.holidayHe || cell.parashaHe
            const baseBg =
              !cell.inMonth ? 'bg-gray-50 text-gray-300'
              : isSelected ? 'bg-orange-500 text-white border-orange-600'
              : isHoliday ? 'bg-purple-50 hover:bg-purple-100'
              : cell.isShabbat ? 'bg-blue-50 hover:bg-blue-100'
              : cell.isToday ? 'bg-yellow-50 hover:bg-yellow-100'
              : 'bg-white hover:bg-gray-50'
            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => selectDay(cell.dateStr)}
                title={label}
                className={`text-start rounded-md border ${isSelected ? '' : 'border-gray-100'} px-1 py-0.5 h-9 flex flex-col justify-center gap-0 transition-colors leading-none ${baseBg}`}
              >
                <div className="flex items-center justify-between gap-0.5">
                  <span className={`font-bold text-xs ${isSelected ? 'text-white' : (cell.inMonth ? 'text-gray-800' : 'text-gray-300')}`}>
                    {cell.hebrewDayLabel}
                  </span>
                  {cell.isToday && cell.inMonth && (
                    <span className={`text-[8px] px-0.5 rounded ${isSelected ? 'bg-white/30' : 'bg-yellow-200 text-yellow-800'}`}>
                      {lang === 'he' ? 'היום' : '·'}
                    </span>
                  )}
                </div>
                {label && (
                  <div className={`text-[9px] leading-tight truncate ${isSelected ? 'text-white/90' : (isHoliday ? 'text-purple-700' : 'text-blue-700')}`}>
                    {label}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day editor */}
      {selectedCell && (
        <div className="card">
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500" dir="rtl">
              <CalendarIcon size={14} />
              <span>{selectedCell.hebrewDayLabel} {currentMonthInfo?.nameHe} {yearToGematriya(hebrewYear)}</span>
              <span className="text-gray-300">·</span>
              <span>{new Date(selectedCell.dateStr).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB')}</span>
            </div>
            <div>
              <label className="label text-sm font-semibold">
                {lang === 'he' ? 'שם התקופה / היום (ניתן לעריכה)' : 'Period / Day Label (editable)'}
              </label>
              <input
                dir="rtl"
                className="input w-full max-w-xl text-base"
                value={labelEdit}
                onChange={e => { setLabelEdit(e.target.value); setLabelTouched(true) }}
                placeholder={lang === 'he' ? 'הקלד שם תקופה...' : 'Type a period name...'}
              />
            </div>
            {matchedTemplate && (
              <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 px-3 py-1.5 rounded-lg text-xs">
                <ListChecks size={12} />
                {lang === 'he'
                  ? `תבנית: ${matchedTemplate.label_he} (${matchedTemplate.items.length} פריטים)`
                  : `Template: ${matchedTemplate.label_he} (${matchedTemplate.items.length} items)`}
              </div>
            )}
            {!matchedTemplate && (selectedCell.isShabbat || selectedCell.holidayHe) && (
              <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs">
                {lang === 'he'
                  ? `אין תבנית עבור ${selectedCell.holidayHe || 'שבת'}.`
                  : `No template for ${selectedCell.holidayEn || 'Shabbat'}.`}
                <Link href="/settings/purchase-templates" className="underline">
                  {lang === 'he' ? 'צור תבנית' : 'Create one'}
                </Link>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[260px]">
                    {lang === 'he' ? 'פריט' : 'Item'}
                  </th>
                  <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[200px]">
                    {T.member}
                  </th>
                  <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[130px]">
                    {T.amount} (€)
                  </th>
                  <th className="text-start py-2 px-2 font-semibold text-gray-600">
                    {T.notes}
                  </th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="py-2 px-2">
                      <input
                        dir="rtl"
                        className="input w-full text-sm"
                        value={row.item_label}
                        onChange={e => updateRow(row.id, { item_label: e.target.value })}
                        placeholder={lang === 'he' ? 'שם הפריט' : 'Item name'}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <MemberSelect
                        members={members}
                        value={row.member_id}
                        onChange={v => updateRow(row.id, { member_id: v })}
                        placeholder={lang === 'he' ? '— ללא חבר —' : '— No member —'}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" className="input w-full text-sm" min="0" step="0.01"
                        value={row.amount}
                        onChange={e => updateRow(row.id, { amount: e.target.value })}
                        placeholder="0.00" />
                    </td>
                    <td className="py-2 px-2">
                      <input className="input w-full text-sm" value={row.notes}
                        onChange={e => updateRow(row.id, { notes: e.target.value })}
                        placeholder={T.notes} />
                    </td>
                    <td className="py-2 px-2">
                      <button type="button" onClick={() => removeRow(row.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <button type="button" onClick={addRow} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={14} /> {lang === 'he' ? 'הוסף שורה' : 'Add Row'}
            </button>
            <div className="flex items-center gap-6">
              {total > 0 && (
                <div className="text-sm font-semibold text-gray-700">
                  {T.total}: <span className="text-orange-600">{fmt(total)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || rows.every(r => !r.amount || !r.item_label.trim())}
                className="btn-primary flex items-center gap-2">
                <CheckCircle size={16} />
                {saving ? T.loading : (lang === 'he' ? 'שמור הכל' : 'Save All')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing purchases for selected day */}
      {existingPurchases.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ShoppingCart size={18} className="text-orange-500" />
            {lang === 'he' ? `רכישות קיימות (${existingPurchases.length})` : `Existing Purchases (${existingPurchases.length})`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-start py-2 px-2 font-semibold text-gray-600">{lang === 'he' ? 'פריט' : 'Item'}</th>
                  <th className="text-start py-2 px-2 font-semibold text-gray-600">{T.member}</th>
                  <th className="text-end py-2 px-2 font-semibold text-gray-600">{T.amount} (€)</th>
                  <th className="text-start py-2 px-2 font-semibold text-gray-600 hidden sm:table-cell">{T.notes}</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {existingPurchases.map(p => {
                  const desc = p.description_he || ''
                  const dashIdx = desc.indexOf(' - ')
                  const itemName = dashIdx > 0 ? desc.substring(dashIdx + 3) : desc
                  const memberName = p.notes?.split(' - ')[0] || (members.find(m => m.id === p.member_id)?.name) || '—'
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-700">{itemName}</td>
                      <td className="py-2 px-2">
                        {p.member_id ? (
                          <Link href={`/members/${p.member_id}`} className="text-blue-700 hover:text-blue-900 hover:underline text-sm">
                            {memberName}
                          </Link>
                        ) : (
                          <span className="text-gray-500 text-sm">{memberName}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-end font-semibold text-orange-600">{fmt(p.amount)}</td>
                      <td className="py-2 px-2 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[150px]">{p.notes || ''}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditPurchase(p)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeletePurchaseId(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Purchase Modal */}
      {editPurchase && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{lang === 'he' ? 'ערוך רכישה' : 'Edit Purchase'}</h2>
              <button onClick={() => setEditPurchase(null)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">{T.amount} (€)</label>
                <input type="number" className="input w-full" min="0" step="0.01"
                  value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.notes}</label>
                <input className="input w-full" value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={() => setEditPurchase(null)} className="btn-secondary">{T.cancel}</button>
              <button onClick={handleEditPurchaseSave} disabled={editSaving} className="btn-primary">
                {editSaving ? T.loading : T.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Purchase Confirm */}
      {deletePurchaseId !== null && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center space-y-4">
            <p className="font-medium text-gray-800">{T.confirmDelete}</p>
            <div className="flex gap-2">
              <button onClick={() => handleDeletePurchase(deletePurchaseId)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">{T.delete}</button>
              <button onClick={() => setDeletePurchaseId(null)} className="btn-secondary flex-1">{T.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PurchasesPage() {
  return (
    <Suspense>
      <PurchasesPageInner />
    </Suspense>
  )
}
