'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Edit2, Trash2, Eye, Phone, Mail, Upload, CalendarDays, CheckCircle, AlertCircle } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import Link from 'next/link'

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

interface FeePreview {
  monthHe: string
  yearHe: string
  totalMembers: number
  toCharge: number
  alreadyCharged: number
}

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' }

export default function MembersPage() {
  const { T, lang } = useLang()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  // Monthly fee state
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null)
  const [feeAmount, setFeeAmount] = useState('20')
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeResult, setFeeResult] = useState<{ count: number; alreadyDone?: boolean } | null>(null)

  const fmt = (n: number) => `₪${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/members?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  async function openFeeModal() {
    setFeeResult(null)
    setShowFeeModal(true)
    const res = await fetch('/api/members/monthly-fee')
    const data = await res.json()
    setFeePreview(data)
  }

  async function handleChargeFee() {
    setFeeLoading(true)
    const res = await fetch('/api/members/monthly-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(feeAmount) }),
    })
    const data = await res.json()
    setFeeResult(data)
    setFeeLoading(false)
    if (data.count > 0) load()
  }

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">{T.members}</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openFeeModal}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl font-medium transition-colors"
          >
            <CalendarDays size={15} />
            {lang === 'he' ? 'חייב דמי חבר' : 'Charge Monthly Fee'}
          </button>
          <Link href="/members/import" className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={15} /> {lang === 'he' ? 'ייבוא' : 'Import'}
          </Link>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {T.addMember}
          </button>
        </div>
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
                      {m.balance < 0 ? `-${fmt(m.balance)}` : m.balance > 0 ? `+${fmt(m.balance)}` : '₪0.00'}
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

      {/* Monthly Fee Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays size={20} className="text-amber-500" />
                {lang === 'he' ? 'חיוב דמי חבר חודשיים' : 'Monthly Membership Fee'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {feeResult ? (
                <div className="text-center space-y-3">
                  {feeResult.count === 0 && feeResult.alreadyDone ? (
                    <div className="flex flex-col items-center gap-2 text-amber-600">
                      <AlertCircle size={40} />
                      <p className="font-medium">{lang === 'he' ? 'כל החברים כבר חויבו החודש' : 'All members already charged this month'}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-green-600">
                      <CheckCircle size={40} />
                      <p className="font-medium">
                        {feeResult.count} {lang === 'he' ? 'חברים חויבו בהצלחה' : 'members charged successfully'}
                      </p>
                    </div>
                  )}
                  <button onClick={() => setShowFeeModal(false)} className="btn-primary w-full mt-2">{T.cancel}</button>
                </div>
              ) : (
                <>
                  {feePreview ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-sm">
                      <div className="font-semibold text-amber-800 text-base">
                        {lang === 'he' ? `חודש: ${feePreview.monthHe} ${feePreview.yearHe}` : `Month: ${feePreview.monthHe} ${feePreview.yearHe}`}
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>{lang === 'he' ? 'חברים פעילים:' : 'Active members:'}</span>
                        <span className="font-medium">{feePreview.totalMembers}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>{lang === 'he' ? 'יחויבו:' : 'Will be charged:'}</span>
                        <span className="font-semibold">{feePreview.toCharge}</span>
                      </div>
                      {feePreview.alreadyCharged > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>{lang === 'he' ? 'כבר חויבו:' : 'Already charged:'}</span>
                          <span>{feePreview.alreadyCharged}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-4">{T.loading}</div>
                  )}
                  <div>
                    <label className="label">{lang === 'he' ? 'סכום לחבר (₪)' : 'Amount per member (₪)'}</label>
                    <input
                      type="number"
                      className="input w-full"
                      value={feeAmount}
                      onChange={e => setFeeAmount(e.target.value)}
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleChargeFee}
                      disabled={feeLoading || !feePreview || feePreview.toCharge === 0}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {feeLoading ? T.loading : (lang === 'he' ? 'חייב עכשיו' : 'Charge Now')}
                    </button>
                    <button onClick={() => setShowFeeModal(false)} className="btn-secondary flex-1">{T.cancel}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
