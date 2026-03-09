'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { RecurringTransaction, Category, RecurringFrequency } from '@/lib/db'
import { RefreshCw, Plus, Pencil, Trash2, Play } from 'lucide-react'
import { MONTH_HE } from '@/lib/hebrewDate'

const EMPTY: Partial<RecurringTransaction> = {
  name_he: '', name_en: '', type: 'expense', amount: 0,
  frequency: 'monthly', day_of_month: 1, active: true,
  start_date: new Date().toISOString().split('T')[0],
}

export default function RecurringPage() {
  const { T, lang, isRTL } = useLang()
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<RecurringTransaction>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')

  async function load() {
    setLoading(true)
    const [r, c] = await Promise.all([fetch('/api/recurring'), fetch('/api/categories')])
    setItems(await r.json())
    setCategories(await c.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setEditing({ ...EMPTY }); setShowModal(true) }
  function openEdit(r: RecurringTransaction) { setEditing({ ...r }); setShowModal(true) }

  async function handleSave() {
    if (!editing.name_he || !editing.type || !editing.amount || !editing.frequency || !editing.start_date) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/recurring/${editing.id}` : '/api/recurring'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm(T.confirmDelete)) return
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    load()
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenMsg('')
    const r = await fetch('/api/recurring/generate', { method: 'POST' })
    const data = await r.json()
    setGenMsg(`${T.generateSuccess} (${data.generated})`)
    setGenerating(false)
    setTimeout(() => setGenMsg(''), 4000)
    load()
  }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const freqLabel = (f: RecurringFrequency) => ({ weekly: T.weekly, monthly: T.monthly, yearly: T.yearly, hebrew_monthly: T.hebrewMonthly }[f] ?? f)

  const hebrewMonthOptions = Object.entries(MONTH_HE).map(([num, name]) => ({ value: Number(num), label: name }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RefreshCw size={24} className="text-purple-600" /> {T.recurringTransactions}
        </h1>
        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={generating}
            className="btn-secondary flex items-center gap-2 text-purple-700 border-purple-200 hover:bg-purple-50">
            <Play size={16} /> {T.generate}
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {T.addRecurring}
          </button>
        </div>
      </div>

      {genMsg && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium">{genMsg}</div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-400">{T.loading}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{T.noRecurring}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.name}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.type}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.amount}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden md:table-cell">{T.frequency}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden md:table-cell">{T.lastGenerated}</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">{T.active}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="font-medium flex items-center gap-2">
                        {r.category_color && <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.category_color }} />}
                        {r.name_he}
                      </div>
                      {r.name_en && <div className="text-xs text-gray-500">{r.name_en}</div>}
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.type === 'income' ? T.income : T.expense}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-end font-semibold">{fmt(Number(r.amount))}</td>
                    <td className="py-3 px-3 text-gray-600 hidden md:table-cell">{freqLabel(r.frequency)}</td>
                    <td className="py-3 px-3 text-gray-500 text-xs hidden md:table-cell">{r.last_generated || '—'}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${r.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <h2 className="text-lg font-bold">{editing.id ? T.editRecurring : T.addRecurring}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{T.nameHe} *</label>
                <input className="input w-full" dir="rtl" value={editing.name_he || ''} onChange={e => setEditing(p => ({ ...p, name_he: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.nameEn}</label>
                <input className="input w-full" dir="ltr" value={editing.name_en || ''} onChange={e => setEditing(p => ({ ...p, name_en: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.type} *</label>
                <select className="input w-full" value={editing.type || 'expense'} onChange={e => setEditing(p => ({ ...p, type: e.target.value as 'income' | 'expense' }))}>
                  <option value="income">{T.income}</option>
                  <option value="expense">{T.expense}</option>
                </select>
              </div>
              <div>
                <label className="label">{T.amount} *</label>
                <input type="number" className="input w-full" value={editing.amount || ''} onChange={e => setEditing(p => ({ ...p, amount: Number(e.target.value) }))} min="0" step="0.01" />
              </div>
              <div>
                <label className="label">{T.category}</label>
                <select className="input w-full" value={editing.category_id || ''} onChange={e => setEditing(p => ({ ...p, category_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">{T.all}</option>
                  {categories.filter(c => c.type === editing.type).map(c => <option key={c.id} value={c.id}>{c.name_he}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{T.frequency} *</label>
                <select className="input w-full" value={editing.frequency || 'monthly'} onChange={e => setEditing(p => ({ ...p, frequency: e.target.value as RecurringFrequency }))}>
                  <option value="weekly">{T.weekly}</option>
                  <option value="monthly">{T.monthly}</option>
                  <option value="yearly">{T.yearly}</option>
                  <option value="hebrew_monthly">{T.hebrewMonthly}</option>
                </select>
              </div>

              {(editing.frequency === 'monthly' || editing.frequency === 'yearly') && (
                <div>
                  <label className="label">{T.dayOfMonth}</label>
                  <input type="number" className="input w-full" min="1" max="31" value={editing.day_of_month || 1}
                    onChange={e => setEditing(p => ({ ...p, day_of_month: Number(e.target.value) }))} />
                </div>
              )}

              {editing.frequency === 'hebrew_monthly' && (
                <div>
                  <label className="label">{T.hebrewDay}</label>
                  <input type="number" className="input w-full" min="1" max="30" value={editing.hebrew_day || 1}
                    onChange={e => setEditing(p => ({ ...p, hebrew_day: Number(e.target.value) }))} />
                </div>
              )}

              {editing.frequency === 'yearly' && (
                <div>
                  <label className="label">{T.hebrewMonth}</label>
                  <select className="input w-full" value={editing.hebrew_month || ''} onChange={e => setEditing(p => ({ ...p, hebrew_month: e.target.value ? Number(e.target.value) : null }))}>
                    <option value="">{T.all}</option>
                    {hebrewMonthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="label">{T.startDate} *</label>
                <input type="date" className="input w-full" value={editing.start_date || ''} onChange={e => setEditing(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.endDate}</label>
                <input type="date" className="input w-full" value={editing.end_date || ''} onChange={e => setEditing(p => ({ ...p, end_date: e.target.value || null }))} />
              </div>
              <div className="col-span-2">
                <label className="label">{T.notes}</label>
                <textarea className="input w-full resize-none" rows={2} value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="active_rec" checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))} />
                <label htmlFor="active_rec" className="text-sm text-gray-700">{T.active}</label>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>{T.cancel}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? T.loading : T.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
