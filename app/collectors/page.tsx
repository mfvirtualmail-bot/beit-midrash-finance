'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Collector } from '@/lib/db'
import { Plus, Pencil, Trash2, Users, Percent } from 'lucide-react'

const EMPTY: Partial<Collector> = { name: '', phone: '', email: '', commission_percent: 10, active: true, notes: '' }

export default function CollectorsPage() {
  const { T, lang, isRTL } = useLang()
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Collector>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === collectors.length ? new Set() : new Set(collectors.map(c => c.id)))
  }
  async function deleteSelected() {
    if (!confirm(T.confirmDelete)) return
    await Promise.all(Array.from(selected).map(id => fetch(`/api/collectors/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    load()
  }

  async function load() {
    setLoading(true)
    const r = await fetch('/api/collectors')
    setCollectors(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setEditing({ ...EMPTY }); setShowModal(true) }
  function openEdit(c: Collector) { setEditing({ ...c }); setShowModal(true) }

  async function handleSave() {
    if (!editing.name) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/collectors/${editing.id}` : '/api/collectors'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm(T.confirmDelete)) return
    await fetch(`/api/collectors/${id}`, { method: 'DELETE' })
    load()
  }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={24} className="text-indigo-500" /> {T.collectors}
        </h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addCollector}
        </button>
      </div>

      <div className="card">
        {/* Batch action bar */}
        {selected.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selected.size} {lang === 'he' ? 'נבחרו' : 'selected'}
            </span>
            <div className="flex gap-2">
              <button onClick={deleteSelected} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium">
                <Trash2 size={14} /> {T.delete}
              </button>
              <button onClick={() => setSelected(new Set())} className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg">
                {T.cancel}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">{T.loading}</div>
        ) : collectors.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{T.noCollectors}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-2 py-2 w-10">
                    <input type="checkbox" checked={selected.size === collectors.length && collectors.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.name}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.phone}</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">{T.commissionPercent}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.totalCollected}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.totalCommission}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.netAmount}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {collectors.map(c => (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected.has(c.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                    </td>
                    <td className="py-3 px-3 text-gray-600 hidden sm:table-cell">{c.phone || '—'}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <Percent size={10} /> {c.commission_percent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-end font-semibold text-gray-900">
                      {c.total_collected ? fmt(c.total_collected) : '—'}
                    </td>
                    <td className="py-3 px-3 text-end font-semibold text-red-600">
                      {c.total_commission ? fmt(c.total_commission) : '—'}
                    </td>
                    <td className="py-3 px-3 text-end font-semibold text-green-600">
                      {c.total_collected ? fmt((c.total_collected ?? 0) - (c.total_commission ?? 0)) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <h2 className="text-lg font-bold">{editing.id ? T.editCollector : T.addCollector}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">{T.name} *</label>
                <input className="input w-full" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.phone}</label>
                <input className="input w-full" value={editing.phone || ''} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.emailLabel}</label>
                <input className="input w-full" type="email" value={editing.email || ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.commissionPercent} *</label>
                <div className="relative">
                  <input type="number" className="input w-full" min="0" max="100" step="0.5"
                    value={editing.commission_percent ?? 10}
                    onChange={e => setEditing(p => ({ ...p, commission_percent: Number(e.target.value) }))} />
                  <span className="absolute top-2.5 end-3 text-gray-400 text-sm">%</span>
                </div>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))} />
                  {T.active}
                </label>
              </div>
              <div className="col-span-2">
                <label className="label">{T.notes}</label>
                <textarea className="input w-full resize-none" rows={2} value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>{T.cancel}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !editing.name}>{saving ? T.loading : T.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
