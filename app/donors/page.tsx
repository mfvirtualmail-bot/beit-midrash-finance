'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Donor } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { Plus, Search, Pencil, Trash2, Heart, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const EMPTY: Partial<Donor> = { name_he: '', name_en: '', phone: '', email: '', address: '', notes: '', active: true }

export default function DonorsPage() {
  const { T, lang, isRTL } = useLang()
  const [donors, setDonors] = useState<Donor[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Donor>>(EMPTY)
  const [saving, setSaving] = useState(false)

  async function load(q = '') {
    setLoading(true)
    const r = await fetch(`/api/donors${q ? `?search=${encodeURIComponent(q)}` : ''}`)
    setDonors(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setEditing({ ...EMPTY }); setShowModal(true) }
  function openEdit(d: Donor) { setEditing({ ...d }); setShowModal(true) }

  async function handleSave() {
    if (!editing.name_he) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/donors/${editing.id}` : '/api/donors'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    setShowModal(false)
    load(search)
  }

  async function handleDelete(id: number) {
    if (!confirm(T.confirmDelete)) return
    await fetch(`/api/donors/${id}`, { method: 'DELETE' })
    load(search)
  }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart size={24} className="text-rose-500" /> {T.donors}
        </h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addDonor}
        </button>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={16} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} />
          <input
            className={`input ${isRTL ? 'pr-9' : 'pl-9'} w-full`}
            placeholder={T.search}
            value={search}
            onChange={e => { setSearch(e.target.value); load(e.target.value) }}
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">{T.loading}</div>
        ) : donors.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{T.noDonors}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.name}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.phone}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden md:table-cell">{T.emailLabel}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.totalDonated}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.active}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {donors.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-medium text-gray-900">{d.name_he}</div>
                      {d.name_en && <div className="text-xs text-gray-500">{d.name_en}</div>}
                    </td>
                    <td className="py-3 px-3 text-gray-600 hidden sm:table-cell">{d.phone || '—'}</td>
                    <td className="py-3 px-3 text-gray-600 hidden md:table-cell">{d.email || '—'}</td>
                    <td className="py-3 px-3 text-end">
                      {d.total_donated != null && d.total_donated > 0
                        ? <span className="font-semibold text-green-600">{fmt(d.total_donated)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-3 text-center hidden sm:table-cell">
                      <span className={`inline-block w-2 h-2 rounded-full ${d.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/donors/${d.id}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title={T.donorDetails}>
                          <ChevronRight size={16} />
                        </Link>
                        <button onClick={() => openEdit(d)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
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
            <h2 className="text-lg font-bold">{editing.id ? T.editDonor : T.addDonor}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{T.nameHe} *</label>
                <input className="input w-full" value={editing.name_he || ''} onChange={e => setEditing(p => ({ ...p, name_he: e.target.value }))} dir="rtl" />
              </div>
              <div>
                <label className="label">{T.nameEn}</label>
                <input className="input w-full" value={editing.name_en || ''} onChange={e => setEditing(p => ({ ...p, name_en: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <label className="label">{T.phone}</label>
                <input className="input w-full" value={editing.phone || ''} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.emailLabel}</label>
                <input className="input w-full" type="email" value={editing.email || ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">{T.address}</label>
                <input className="input w-full" value={editing.address || ''} onChange={e => setEditing(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">{T.notes}</label>
                <textarea className="input w-full resize-none" rows={2} value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="active" checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))} />
                <label htmlFor="active" className="text-sm text-gray-700">{T.active}</label>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>{T.cancel}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !editing.name_he}>{saving ? T.loading : T.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
