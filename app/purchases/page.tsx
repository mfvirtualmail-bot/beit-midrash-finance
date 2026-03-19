'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Category, Member } from '@/lib/db'
import { HDate } from '@hebcal/core'
import { MONTH_HE, MONTH_EN, getShabbatOrHolidayLabel, getHebrewMonthsInYear, hebrewMonthToGregorianRange } from '@/lib/hebrewDate'
import { ShoppingCart, Plus, Trash2, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Settings, Edit2, Calendar, Upload, Pencil, X } from 'lucide-react'
import Link from 'next/link'

interface PurchaseRow {
  id: string
  category_id: number | ''
  member_id: number | ''
  amount: string
  notes: string
}

function uuid() { return Math.random().toString(36).slice(2) }
function newRow(): PurchaseRow {
  return { id: uuid(), category_id: '', member_id: '', amount: '', notes: '' }
}

function getHebrewWeekStart(date: Date): Date {
  const dow = date.getDay()
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - dow)
  return sunday
}

function getWeeksForMonth(hebrewMonth: number, hebrewYear: number, lang: 'he' | 'en' = 'he'): Array<{ label: string; dateStr: string; shabbatLabel: string; shabbatLabelEn: string }> {
  const range = hebrewMonthToGregorianRange(hebrewMonth, hebrewYear)
  const startDate = new Date(range.start)
  const endDate = new Date(range.end)
  const firstSunday = getHebrewWeekStart(startDate)
  const lastDate = new Date(endDate)
  const lastSat = new Date(lastDate)
  lastSat.setDate(lastDate.getDate() + (6 - lastDate.getDay()))

  const weeks: Array<{ label: string; dateStr: string; shabbatLabel: string; shabbatLabelEn: string }> = []
  const current = new Date(firstSunday)

  while (current <= lastSat) {
    const sunday = new Date(current)
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    const hdSun = new HDate(sunday)
    const hdSat = new HDate(saturday)
    const hebrewSunDay = hdSun.getDate()
    const hebrewSunMonth = MONTH_HE[hdSun.getMonth()] ?? ''
    const hebrewSatDay = hdSat.getDate()
    const hebrewSatMonth = MONTH_HE[hdSat.getMonth()] ?? ''
    const sameMonth = hdSun.getMonth() === hdSat.getMonth()
    const hebrewLabel = sameMonth
      ? `${hebrewSunDay}–${hebrewSatDay} ${hebrewSunMonth}`
      : `${hebrewSunDay} ${hebrewSunMonth} – ${hebrewSatDay} ${hebrewSatMonth}`
    const greg = `${sunday.toLocaleDateString('en-GB')} – ${saturday.toLocaleDateString('en-GB')}`
    const sundayStr = sunday.toISOString().split('T')[0]
    const shabbatLabel = getShabbatOrHolidayLabel(sundayStr, 'he')
    const shabbatLabelEn = getShabbatOrHolidayLabel(sundayStr, 'en')
    weeks.push({
      label: `${shabbatLabel ? shabbatLabel + ' | ' : ''}${hebrewLabel}  (${greg})`,
      dateStr: sundayStr,
      shabbatLabel,
      shabbatLabelEn,
    })
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

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

function PurchasesPageInner() {
  const { T, lang, isRTL } = useLang()
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<Member[]>([])

  // Hebrew month navigation
  const todayHeb = new HDate(new Date())
  const [hebrewYear, setHebrewYear] = useState(todayHeb.getFullYear())
  const [hebrewMonth, setHebrewMonth] = useState(todayHeb.getMonth())
  const monthsInYear = getHebrewMonthsInYear(hebrewYear)
  const currentMonthInfo = monthsInYear.find(m => m.month === hebrewMonth)

  const weeks = getWeeksForMonth(hebrewMonth, hebrewYear, lang as 'he' | 'en')
  const initialWeek = searchParams?.get('week') ?? weeks[0]?.dateStr ?? ''
  const [weekDate, setWeekDate] = useState(initialWeek)

  // If weekDate is not in current month's weeks, select the first one
  const weekInList = weeks.find(w => w.dateStr === weekDate)
  const effectiveWeekDate = weekInList ? weekDate : (weeks[0]?.dateStr ?? '')

  function navigateMonth(dir: -1 | 1) {
    const idx = monthsInYear.findIndex(m => m.month === hebrewMonth)
    const newIdx = idx + dir
    if (newIdx >= 0 && newIdx < monthsInYear.length) {
      setHebrewMonth(monthsInYear[newIdx].month)
    } else if (dir === 1) {
      const nextYear = hebrewYear + 1
      const nextMonths = getHebrewMonthsInYear(nextYear)
      setHebrewYear(nextYear)
      setHebrewMonth(nextMonths[0].month)
    } else if (dir === -1) {
      const prevYear = hebrewYear - 1
      const prevMonths = getHebrewMonthsInYear(prevYear)
      setHebrewYear(prevYear)
      setHebrewMonth(prevMonths[prevMonths.length - 1].month)
    }
  }
  const [rows, setRows] = useState<PurchaseRow[]>([newRow(), newRow(), newRow()])
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  // Purchase types management modal
  const [showTypesModal, setShowTypesModal] = useState(false)
  const [typeForm, setTypeForm] = useState({ name_he: '' })
  const [editingType, setEditingType] = useState<Category | null>(null)
  const [savingType, setSavingType] = useState(false)
  const [deleteTypeId, setDeleteTypeId] = useState<number | null>(null)
  // Existing purchases for selected week
  interface ExistingPurchase { id: number; amount: number; description_he: string; date: string; notes: string | null; member_id: number | null; member_name?: string; category_name_he?: string }
  const [existingPurchases, setExistingPurchases] = useState<ExistingPurchase[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [editPurchase, setEditPurchase] = useState<ExistingPurchase | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', notes: '' })
  const [deletePurchaseId, setDeletePurchaseId] = useState<number | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  async function loadExistingPurchases(weekStr: string) {
    if (!weekStr) return
    setLoadingPurchases(true)
    try {
      // Get the Saturday of the week
      const [y, m, d] = weekStr.split('-').map(Number)
      const sunday = new Date(y, m - 1, d)
      const saturday = new Date(sunday)
      saturday.setDate(sunday.getDate() + 6)
      const satStr = saturday.toISOString().split('T')[0]

      const res = await fetch(`/api/transactions?type=purchase&limit=500`)
      const data = await res.json()
      // Filter to purchases in this week
      const weekPurchases = (data as ExistingPurchase[]).filter((tx: ExistingPurchase) =>
        tx.date >= weekStr && tx.date <= satStr && tx.member_id
      )
      setExistingPurchases(weekPurchases)
    } catch { setExistingPurchases([]) }
    setLoadingPurchases(false)
  }

  // Load existing purchases when week changes
  useEffect(() => { if (effectiveWeekDate) loadExistingPurchases(effectiveWeekDate) }, [effectiveWeekDate])

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
    loadExistingPurchases(effectiveWeekDate)
  }

  async function handleDeletePurchase(id: number) {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setDeletePurchaseId(null)
    loadExistingPurchases(effectiveWeekDate)
  }

  async function loadCategories() {
    const res = await fetch('/api/categories')
    const data = await res.json()
    setCategories(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    Promise.all([fetch('/api/categories'), fetch('/api/members')]).then(async ([c, m]) => {
      setCategories(await c.json())
      setMembers(await m.json())
    })
  }, [])

  function updateRow(id: string, field: keyof PurchaseRow, value: string | number | '') {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function addRow() { setRows(prev => [...prev, newRow()]) }
  function removeRow(id: string) { setRows(prev => prev.filter(r => r.id !== id)) }

  const selectedWeek = weeks.find(w => w.dateStr === effectiveWeekDate)
  const shabbatLabel = selectedWeek?.shabbatLabel ?? ''

  async function handleSave() {
    const valid = rows.filter(r => r.category_id && r.amount && Number(r.amount) > 0)
    if (valid.length === 0) return
    setSaving(true)
    const txns = valid.map(r => {
      const catName = purchaseCategories.find(c => c.id === r.category_id)?.name_he ?? ''
      const descHe = shabbatLabel ? `${shabbatLabel} - ${catName}` : catName
      const memberName = r.member_id ? (members.find(m => m.id === r.member_id)?.name ?? '') : ''
      const notesStr = memberName
        ? `${memberName}${r.notes ? ' - ' + r.notes : ''}`
        : r.notes || null
      return {
        type: 'purchase',
        amount: Number(r.amount),
        description_he: descHe,
        description_en: null,
        category_id: r.category_id || null,
        member_id: r.member_id || null,
        date: effectiveWeekDate,
        notes: notesStr,
      }
    })
    await Promise.all(txns.map(tx =>
      fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) })
    ))
    setSaving(false)
    setSavedCount(valid.length)
    setRows([newRow(), newRow(), newRow()])
    setTimeout(() => setSavedCount(null), 4000)
    loadExistingPurchases(effectiveWeekDate)
  }

  function openAddType() {
    setEditingType(null)
    setTypeForm({ name_he: '' })
  }

  function openEditType(cat: Category) {
    setEditingType(cat)
    setTypeForm({ name_he: cat.name_he })
  }

  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault()
    if (!typeForm.name_he.trim()) return
    setSavingType(true)
    const url = editingType ? `/api/categories/${editingType.id}` : '/api/categories'
    const method = editingType ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name_he: typeForm.name_he, name_en: typeForm.name_he, type: 'purchase', color: '#6b7280' }),
    })
    setSavingType(false)
    setEditingType(null)
    setTypeForm({ name_he: '' })
    loadCategories()
  }

  async function handleDeleteType(id: number) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setDeleteTypeId(null)
    loadCategories()
  }

  const purchaseCategories = categories.filter(c => c.type === 'purchase')
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={24} className="text-orange-500" />
          {lang === 'he' ? 'הזנת רכישות שבועיות' : 'Weekly Purchases Entry'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/purchases/import"
            className="flex items-center gap-2 text-sm px-3 py-2 bg-green-50 border border-green-300 text-green-800 hover:bg-green-100 rounded-xl font-medium transition-colors"
          >
            <Upload size={15} />
            {lang === 'he' ? 'ייבוא מ-Excel' : 'Import from Excel'}
          </Link>
          <button
            onClick={() => setShowTypesModal(true)}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-orange-50 border border-orange-300 text-orange-800 hover:bg-orange-100 rounded-xl font-medium transition-colors"
          >
            <Settings size={15} />
            {lang === 'he' ? 'נהל סוגי רכישות' : 'Manage Purchase Types'}
          </button>
        </div>
      </div>

      {savedCount !== null && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={18} />
          <span>{lang === 'he' ? `${savedCount} רכישות נשמרו בהצלחה` : `${savedCount} purchases saved successfully`}</span>
        </div>
      )}

      <div className="card">
        <div className="mb-6 space-y-4">
          {/* Hebrew month navigation */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <button onClick={() => navigateMonth(isRTL ? 1 : -1)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <span className="font-bold text-gray-900">
                {lang === 'he' ? currentMonthInfo?.nameHe : currentMonthInfo?.nameEn}
              </span>
              <span className="text-sm text-gray-500 mx-2">{hebrewYear}</span>
            </div>
            <button onClick={() => navigateMonth(isRTL ? -1 : 1)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div>
            <label className="label text-base font-semibold">
              {lang === 'he' ? 'בחר שבוע / חג' : 'Select Week / Holiday'}
            </label>
            <select className="input w-full max-w-xl text-sm" dir="rtl" value={effectiveWeekDate} onChange={e => setWeekDate(e.target.value)}>
              {weeks.map(w => (
                <option key={w.dateStr} value={w.dateStr}>{w.label}</option>
              ))}
            </select>
          </div>

          {selectedWeek?.shabbatLabel && (
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium" dir="rtl">
              <Calendar size={14} />
              {lang === 'he' ? selectedWeek.shabbatLabel : selectedWeek.shabbatLabelEn}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[220px]">
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
                    <select className="input w-full text-sm" dir={isRTL ? 'rtl' : 'ltr'}
                      value={row.category_id}
                      onChange={e => updateRow(row.id, 'category_id', e.target.value ? Number(e.target.value) : '')}>
                      <option value="">{lang === 'he' ? '— בחר פריט —' : '— Select item —'}</option>
                      {purchaseCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name_he}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <MemberSelect
                      members={members}
                      value={row.member_id}
                      onChange={v => updateRow(row.id, 'member_id', v)}
                      placeholder={lang === 'he' ? '— ללא חבר —' : '— No member —'}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" className="input w-full text-sm" min="0" step="0.01"
                      value={row.amount}
                      onChange={e => updateRow(row.id, 'amount', e.target.value)}
                      placeholder="0.00" />
                  </td>
                  <td className="py-2 px-2">
                    <input className="input w-full text-sm" value={row.notes}
                      onChange={e => updateRow(row.id, 'notes', e.target.value)}
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
              disabled={saving || rows.every(r => !r.category_id || !r.amount)}
              className="btn-primary flex items-center gap-2">
              <CheckCircle size={16} />
              {saving ? T.loading : (lang === 'he' ? 'שמור הכל' : 'Save All')}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Purchases for Selected Week */}
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
                  const itemName = dashIdx > 0 ? desc.substring(dashIdx + 3) : (p.category_name_he || desc)
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

      {/* Purchase Types Management Modal */}
      {showTypesModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings size={18} className="text-orange-500" />
                {lang === 'he' ? 'ניהול סוגי רכישות' : 'Manage Purchase Types'}
              </h2>
              <button onClick={() => { setShowTypesModal(false); setEditingType(null); setTypeForm({ name_he: '' }) }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Add / Edit form */}
              <form onSubmit={handleSaveType} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-orange-800">
                  {editingType ? (lang === 'he' ? 'ערוך סוג' : 'Edit Type') : (lang === 'he' ? 'הוסף סוג חדש' : 'Add New Type')}
                </div>
                <div>
                  <label className="label text-xs">{lang === 'he' ? 'שם בעברית *' : 'Hebrew Name *'}</label>
                  <input dir="rtl" className="input w-full text-sm" required
                    value={typeForm.name_he} onChange={e => setTypeForm(f => ({ ...f, name_he: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={savingType} className="btn-primary text-sm flex-1">
                    {savingType ? T.loading : (editingType ? T.save : T.add)}
                  </button>
                  {editingType && (
                    <button type="button" onClick={() => { setEditingType(null); setTypeForm({ name_he: '' }) }}
                      className="btn-secondary text-sm px-3">{T.cancel}</button>
                  )}
                </div>
              </form>

              {/* Types list */}
              <div className="space-y-1">
                {purchaseCategories.length === 0 && (
                  <p className="text-center text-gray-400 py-4 text-sm">{lang === 'he' ? 'אין סוגי רכישות' : 'No purchase types'}</p>
                )}
                {purchaseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 group">
                    <span className="font-medium text-gray-800 flex-1" dir="rtl">{cat.name_he}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditType(cat)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setDeleteTypeId(cat.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete type confirm */}
      {deleteTypeId !== null && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center space-y-4">
            <p className="font-medium text-gray-800">{T.confirmDelete}</p>
            <div className="flex gap-2">
              <button onClick={() => handleDeleteType(deleteTypeId)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">{T.delete}</button>
              <button onClick={() => setDeleteTypeId(null)} className="btn-secondary flex-1">{T.cancel}</button>
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
