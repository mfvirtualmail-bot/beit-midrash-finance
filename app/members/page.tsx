'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Edit2, Trash2, Eye, Phone, Mail } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

interface Member {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: number
  total_charges: number
  total_payments: number
  balance: number
}

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' }

export default function MembersPage() {
  const { T } = useLang()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/members?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(m: Member) {
    setEditing(m)
    setForm({ name: m.name, phone: m.phone || '', email: m.email || '', address: m.address || '', notes: m.notes || '' })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editing ? `/api/members/${editing.id}` : '/api/members'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
    if (res.ok) { setDeleteId(null); load() }
  }

  const totalOwing = members.filter(m => m.balance < 0).reduce((s, m) => s + Math.abs(m.balance), 0)
  const totalCredit = members.filter(m => m.balance > 0).reduce((s, m) => s + m.balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{T.members}</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addMember}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500">{T.members}</p>
          <p className="text-2xl font-bold text-gray-800">{members.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">{T.owes}</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalOwing)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">{T.credit}</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalCredit)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input ps-9 w-full sm:w-72"
          placeholder={T.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{T.loading}</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{T.noData}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-start">{T.name}</th>
                <th className="px-4 py-3 text-start hidden sm:table-cell">{T.phone}</th>
                <th className="px-4 py-3 text-end">{T.totalCharges}</th>
                <th className="px-4 py-3 text-end">{T.totalPayments}</th>
                <th className="px-4 py-3 text-end">{T.balance}</th>
                <th className="px-4 py-3 text-end"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <button onClick={() => router.push(`/members/${m.id}`)} className="hover:text-blue-600 text-start">
                      {m.name}
                    </button>
                    {m.email && <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Mail size={10} />{m.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {m.phone && <span className="flex items-center gap-1"><Phone size={12} />{m.phone}</span>}
                  </td>
                  <td className="px-4 py-3 text-end text-red-600">{fmt(m.total_charges)}</td>
                  <td className="px-4 py-3 text-end text-green-600">{fmt(m.total_payments)}</td>
                  <td className="px-4 py-3 text-end font-semibold">
                    <span className={m.balance < 0 ? 'text-red-600' : m.balance > 0 ? 'text-green-600' : 'text-gray-500'}>
                      {m.balance < 0 ? `-${fmt(m.balance)}` : m.balance > 0 ? `+${fmt(m.balance)}` : '€0.00'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => router.push(`/members/${m.id}`)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg" title={T.memberDetails}>
                        <Eye size={15} />
                      </button>
                      <button onClick={() => openEdit(m)} className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteId(m.id)} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{editing ? T.editMember : T.addMember}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">{T.name} *</label>
                <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{T.phone}</label>
                  <input className="input w-full" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{T.emailLabel}</label>
                  <input className="input w-full" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{T.address}</label>
                <input className="input w-full" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.notes}</label>
                <textarea className="input w-full" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? T.loading : T.save}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">{T.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center space-y-4">
            <p className="font-medium text-gray-800">{T.confirmDelete}</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">{T.delete}</button>
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">{T.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
