'use client'
import { useEffect, useState, useRef } from 'react'
import { useLang } from '@/lib/LangContext'
import { Category, Member } from '@/lib/db'
import { HDate } from '@hebcal/core'
import { MONTH_HE } from '@/lib/hebrewDate'
import { ShoppingCart, Plus, Trash2, CheckCircle, ChevronDown } from 'lucide-react'

interface PurchaseRow {
  id: string
  category_id: number | ''
  member_id: number | ''
  amount: string
  description_he: string
  notes: string
}

function uuid() { return Math.random().toString(36).slice(2) }

function newRow(): PurchaseRow {
  return { id: uuid(), category_id: '', member_id: '', amount: '', description_he: '', notes: '' }
}

// Get the Sunday of the Hebrew week containing the given date
function getHebrewWeekStart(date: Date): Date {
  const dow = date.getDay() // 0=Sunday
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - dow)
  return sunday
}

// Generate list of recent Sundays (12 weeks back)
function getRecentWeeks(): Array<{ label: string; dateStr: string }> {
  const weeks = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 12; i++) {
    const sunday = getHebrewWeekStart(today)
    sunday.setDate(sunday.getDate() - i * 7)
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    // Hebrew dates for Sunday and Saturday
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
    weeks.push({
      label: `${hebrewLabel}  (${greg})`,
      dateStr: sunday.toISOString().split('T')[0],
    })
  }
  return weeks
}

// Searchable member selector
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

  const filtered = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  )

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

export default function PurchasesPage() {
  const { T, lang, isRTL } = useLang()
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const weeks = getRecentWeeks()
  const [weekDate, setWeekDate] = useState(weeks[0].dateStr)
  const [rows, setRows] = useState<PurchaseRow[]>([newRow(), newRow(), newRow()])
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)

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

  async function handleSave() {
    const valid = rows.filter(r => r.category_id && r.amount && Number(r.amount) > 0)
    if (valid.length === 0) return
    setSaving(true)
    const txns = valid.map(r => ({
      type: 'expense',
      amount: Number(r.amount),
      description_he: r.description_he || (categories.find(c => c.id === r.category_id)?.name_he ?? ''),
      description_en: null,
      category_id: r.category_id || null,
      date: weekDate,
      notes: r.member_id
        ? `${members.find(m => m.id === r.member_id)?.name ?? ''}${r.notes ? ' - ' + r.notes : ''}`
        : r.notes || null,
    }))

    // Bulk insert by posting each one (could be batched but keep simple)
    await Promise.all(txns.map(tx =>
      fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) })
    ))
    setSaving(false)
    setSavedCount(valid.length)
    setRows([newRow(), newRow(), newRow()])
    setTimeout(() => setSavedCount(null), 4000)
  }

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={24} className="text-orange-500" />
          {lang === 'he' ? 'הזנת רכישות שבועיות' : 'Weekly Purchases Entry'}
        </h1>
      </div>

      {savedCount !== null && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={18} />
          <span>{lang === 'he' ? `${savedCount} רכישות נשמרו בהצלחה` : `${savedCount} purchases saved successfully`}</span>
        </div>
      )}

      <div className="card">
        <div className="mb-6">
          <label className="label text-base font-semibold">
            {lang === 'he' ? 'בחר שבוע עברי' : 'Select Hebrew Week'}
          </label>
          <select className="input w-full max-w-md text-sm" dir="rtl" value={weekDate} onChange={e => setWeekDate(e.target.value)}>
            {weeks.map(w => (
              <option key={w.dateStr} value={w.dateStr}>{w.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[220px]">
                  {lang === 'he' ? 'סוג רכישה' : 'Purchase Type'}
                </th>
                <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[200px]">
                  {T.member}
                </th>
                <th className="text-start py-2 px-2 font-semibold text-gray-600 w-[130px]">
                  {T.amount} (₪)
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
                      <option value="">{lang === 'he' ? '— בחר סוג —' : '— Select type —'}</option>
                      {expenseCategories.map(c => (
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
    </div>
  )
}
