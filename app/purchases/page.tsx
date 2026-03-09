'use client'
import { useEffect, useState, useRef } from 'react'
import { useLang } from '@/lib/LangContext'
import { Category, Member } from '@/lib/db'
import { HDate } from '@hebcal/core'
import { MONTH_HE, getShabbatOrHolidayLabel } from '@/lib/hebrewDate'
import { ShoppingCart, Plus, Trash2, CheckCircle, ChevronDown, Settings, Edit2 } from 'lucide-react'

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

function getHebrewWeekStart(date: Date): Date {
  const dow = date.getDay()
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - dow)
  return sunday
}

function getRecentWeeks(): Array<{ label: string; dateStr: string; shabbatLabel: string }> {
  const weeks = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 12; i++) {
    const sunday = getHebrewWeekStart(today)
    sunday.setDate(sunday.getDate() - i * 7)
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
    weeks.push({
      label: `${shabbatLabel ? shabbatLabel + ' | ' : ''}${hebrewLabel}  (${greg})`,
      dateStr: sundayStr,
      shabbatLabel,
    })
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

export default function PurchasesPage() {
  const { T, lang, isRTL } = useLang()
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const weeks = getRecentWeeks()
  const [weekDate, setWeekDate] = useState(weeks[0].dateStr)
  const [rows, setRows] = useState<PurchaseRow[]>([newRow(), newRow(), newRow()])
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  // Purchase types management modal
  const [showTypesModal, setShowTypesModal] = useState(false)
  const [typeForm, setTypeForm] = useState({ name_he: '', name_en: '', color: '#f97316' })
  const [editingType, setEditingType] = useState<Category | null>(null)
  const [savingType, setSavingType] = useState(false)
  const [deleteTypeId, setDeleteTypeId] = useState<number | null>(null)

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
    await Promise.all(txns.map(tx =>
      fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) })
    ))
    setSaving(false)
    setSavedCount(valid.length)
    setRows([newRow(), newRow(), newRow()])
    setTimeout(() => setSavedCount(null), 4000)
  }

  function openAddType() {
    setEditingType(null)
    setTypeForm({ name_he: '', name_en: '', color: '#f97316' })
  }

  function openEditType(cat: Category) {
    setEditingType(cat)
    setTypeForm({ name_he: cat.name_he, name_en: cat.name_en, color: cat.color })
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
      body: JSON.stringify({ ...typeForm, type: 'expense' }),
    })
    setSavingType(false)
    setEditingType(null)
    setTypeForm({ name_he: '', name_en: '', color: '#f97316' })
    loadCategories()
  }

  async function handleDeleteType(id: number) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setDeleteTypeId(null)
    loadCategories()
  }

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)

  const selectedWeek = weeks.find(w => w.dateStr === weekDate)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={24} className="text-orange-500" />
          {lang === 'he' ? 'הזנת רכישות שבועיות' : 'Weekly Purchases Entry'}
        </h1>
        <button
          onClick={() => setShowTypesModal(true)}
          className="flex items-center gap-2 text-sm px-3 py-2 bg-orange-50 border border-orange-300 text-orange-800 hover:bg-orange-100 rounded-xl font-medium transition-colors"
        >
          <Settings size={15} />
          {lang === 'he' ? 'נהל סוגי רכישות' : 'Manage Purchase Types'}
        </button>
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
            {lang === 'he' ? 'בחר שבוע / חג' : 'Select Week / Holiday'}
          </label>
          <select className="input w-full max-w-xl text-sm" dir="rtl" value={weekDate} onChange={e => setWeekDate(e.target.value)}>
            {weeks.map(w => (
              <option key={w.dateStr} value={w.dateStr}>{w.label}</option>
            ))}
          </select>
          {selectedWeek?.shabbatLabel && (
            <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium" dir="rtl">
              ✡ {selectedWeek.shabbatLabel}
            </div>
          )}
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

      {/* Purchase Types Management Modal */}
      {showTypesModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings size={18} className="text-orange-500" />
                {lang === 'he' ? 'ניהול סוגי רכישות' : 'Manage Purchase Types'}
              </h2>
              <button onClick={() => { setShowTypesModal(false); setEditingType(null); setTypeForm({ name_he: '', name_en: '', color: '#f97316' }) }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Add / Edit form */}
              <form onSubmit={handleSaveType} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-orange-800">
                  {editingType ? (lang === 'he' ? 'ערוך סוג' : 'Edit Type') : (lang === 'he' ? 'הוסף סוג חדש' : 'Add New Type')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-xs">{lang === 'he' ? 'שם (עברית) *' : 'Hebrew Name *'}</label>
                    <input dir="rtl" className="input w-full text-sm" required
                      value={typeForm.name_he} onChange={e => setTypeForm(f => ({ ...f, name_he: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label text-xs">{lang === 'he' ? 'שם (אנגלית)' : 'English Name'}</label>
                    <input dir="ltr" className="input w-full text-sm"
                      value={typeForm.name_en} onChange={e => setTypeForm(f => ({ ...f, name_en: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="label text-xs">{T.color}</label>
                    <input type="color" className="h-9 w-12 rounded cursor-pointer border border-gray-200"
                      value={typeForm.color} onChange={e => setTypeForm(f => ({ ...f, color: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 flex-1 items-end">
                    <button type="submit" disabled={savingType} className="btn-primary text-sm flex-1">
                      {savingType ? T.loading : (editingType ? T.save : T.add)}
                    </button>
                    {editingType && (
                      <button type="button" onClick={() => { setEditingType(null); setTypeForm({ name_he: '', name_en: '', color: '#f97316' }) }}
                        className="btn-secondary text-sm px-3">{T.cancel}</button>
                    )}
                  </div>
                </div>
              </form>

              {/* Types list */}
              <div className="space-y-1">
                {expenseCategories.length === 0 && (
                  <p className="text-center text-gray-400 py-4 text-sm">{lang === 'he' ? 'אין סוגי רכישות' : 'No purchase types'}</p>
                )}
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 group">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="font-medium text-gray-800 flex-1" dir="rtl">{cat.name_he}</span>
                    {cat.name_en && <span className="text-gray-400 text-sm">{cat.name_en}</span>}
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
