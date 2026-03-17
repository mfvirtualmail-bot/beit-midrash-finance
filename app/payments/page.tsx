'use client'
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'
import { Plus, Search, Trash2, Upload, CheckCircle, Banknote, Pencil, X } from 'lucide-react'
import Link from 'next/link'

interface Payment {
  id: number
  member_id: number
  amount: number
  date: string
  method: string
  reference: string | null
  notes: string | null
  created_at: string
  member_name: string | null
}

interface MemberOption {
  id: number
  name: string
}

const EMPTY_FORM = { member_id: '', amount: '', date: '', hebrewDateText: '', method: '', reference: '', notes: '' }

export default function PaymentsPage() {
  const { T, lang } = useLang()
  const he = lang === 'he'

  const [payments, setPayments] = useState<Payment[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [successMsg, setSuccessMsg] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<Array<{ value: string; label_he: string; label_en: string }>>([])
  const [customMethod, setCustomMethod] = useState('')

  const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Load payment methods from settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (Array.isArray(data?.payment_methods)) {
        setPaymentMethods(data.payment_methods)
      }
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/payments?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setPayments(data.payments ?? [])
    setMembers(data.members ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const methodLabel = (m: string | null) => {
    if (!m) return '—'
    const found = paymentMethods.find(pm => pm.value === m)
    if (found) return he ? found.label_he : found.label_en
    // Legacy fallback
    switch (m) {
      case 'cash': return T.cash
      case 'bank': case 'bank_transfer': return T.bankTransfer
      case 'check': return T.check
      case 'credit_card': return he ? 'כרטיס אשראי' : 'Credit Card'
      case 'unknown': return T.unknown
      default: return m
    }
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
    setMemberSearch('')
    setShowForm(true)
    setSuccessMsg('')
  }

  function openEdit(payment: Payment) {
    setEditing(payment)
    setForm({
      member_id: String(payment.member_id),
      amount: String(payment.amount),
      date: payment.date,
      hebrewDateText: payment.reference || '',
      method: payment.method,
      reference: '',
      notes: payment.notes || '',
    })
    setMemberSearch(payment.member_name || '')
    setShowForm(true)
    setSuccessMsg('')
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  function selectMember(m: MemberOption) {
    setForm(f => ({ ...f, member_id: String(m.id) }))
    setMemberSearch(m.name)
    setShowDropdown(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const actualMethod = form.method === '__custom__' ? customMethod : form.method
    if (!form.member_id || !form.amount || !actualMethod) return
    setSaving(true)
    try {
      if (editing) {
        // Update existing payment
        const res = await fetch(`/api/members/${editing.member_id}/payments/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(form.amount),
            date: form.date || undefined,
            method: actualMethod || 'unknown',
            reference: form.hebrewDateText || form.reference || undefined,
            notes: form.notes || undefined,
          }),
        })
        if (res.ok) {
          setShowForm(false)
          setEditing(null)
          setCustomMethod('')
          setSuccessMsg(he ? 'התשלום עודכן בהצלחה' : 'Payment updated successfully')
          setTimeout(() => setSuccessMsg(''), 3000)
          load()
        }
      } else {
        // Create new payment
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: Number(form.member_id),
            amount: Number(form.amount),
            date: form.date || undefined,
            method: actualMethod || 'unknown',
            reference: form.hebrewDateText || form.reference || undefined,
            notes: form.notes || undefined,
          }),
        })
        if (res.ok) {
          setShowForm(false)
          setSuccessMsg(he ? 'התשלום נרשם בהצלחה' : 'Payment recorded successfully')
          setTimeout(() => setSuccessMsg(''), 3000)
          load()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    const payment = payments.find(p => p.id === id)
    if (!payment) return
    await fetch(`/api/members/${payment.member_id}/payments/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === payments.length ? new Set() : new Set(payments.map(p => p.id)))
  }
  async function deleteSelected() {
    if (!confirm(T.confirmDelete)) return
    await Promise.all(
      Array.from(selected).map(id => {
        const payment = payments.find(p => p.id === id)
        if (!payment) return Promise.resolve()
        return fetch(`/api/members/${payment.member_id}/payments/${id}`, { method: 'DELETE' })
      })
    )
    setSelected(new Set())
    load()
  }

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Banknote size={24} className="text-green-600" />
          {he ? 'תשלומים' : 'Payments'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/payments/import" className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={15} /> {he ? 'ייבוא מ-Excel' : 'Import from Excel'}
          </Link>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {he ? 'רשום תשלום' : 'Record Payment'}
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500">{he ? 'מספר תשלומים' : 'Total Payments'}</p>
          <p className="text-2xl font-bold text-gray-800">{payments.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">{he ? 'סה"כ סכום' : 'Total Amount'}</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalAmount)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input ps-9 w-full sm:w-72"
          placeholder={he ? 'חיפוש לפי שם, הערות...' : 'Search by name, notes...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-800">
            {selected.size} {he ? 'נבחרו' : 'selected'}
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

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{T.loading}</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{he ? 'אין תשלומים' : 'No payments'}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-2 py-3 w-10">
                  <input type="checkbox" checked={selected.size === payments.length && payments.length > 0} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="px-4 py-3 text-start">{T.date}</th>
                <th className="px-4 py-3 text-start">{he ? 'חבר' : 'Member'}</th>
                <th className="px-4 py-3 text-end">{T.amount}</th>
                <th className="px-4 py-3 text-start hidden sm:table-cell">{he ? 'אמצעי' : 'Method'}</th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{T.notes}</th>
                <th className="px-4 py-3 text-center w-20">{T.edit}/{T.delete}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selected.has(p.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.date}</td>
                  <td className="px-4 py-3 font-medium">
                    {p.member_id ? (
                      <Link href={`/members/${p.member_id}`} className="text-blue-700 hover:text-blue-900 hover:underline">
                        {p.member_name || '—'}
                      </Link>
                    ) : (
                      <span className="text-gray-800">{p.member_name || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end font-semibold text-green-600">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {methodLabel(p.method)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell max-w-[200px] truncate">
                    {p.reference && <span className="text-blue-500 me-1">[{p.reference}]</span>}
                    {p.notes || ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Payment Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Banknote size={20} className="text-green-500" />
                {editing ? (he ? 'ערוך תשלום' : 'Edit Payment') : (he ? 'רשום תשלום' : 'Record Payment')}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1 rounded hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Member searchable dropdown */}
              <div className="relative">
                <label className="label">{he ? 'שם חבר' : 'Member Name'} *</label>
                <input
                  className="input w-full"
                  placeholder={he ? 'הקלד שם לחיפוש...' : 'Type to search...'}
                  value={memberSearch}
                  onChange={e => {
                    setMemberSearch(e.target.value)
                    setShowDropdown(true)
                    if (form.member_id) {
                      const selectedMember = members.find(m => m.id === Number(form.member_id))
                      if (selectedMember && e.target.value !== selectedMember.name) {
                        setForm(f => ({ ...f, member_id: '' }))
                      }
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  disabled={!!editing}
                  required
                />
                {showDropdown && memberSearch && filteredMembers.length > 0 && !editing && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMember(m)}
                        className="w-full text-start px-4 py-2.5 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && memberSearch && filteredMembers.length === 0 && !editing && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm text-gray-400 text-center">
                    {he ? 'לא נמצא חבר' : 'No member found'}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="label">{T.amount} (€) *</label>
                <input
                  type="number"
                  className="input w-full"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              {/* Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{T.date}</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{he ? 'תאריך עברי / תקופה' : 'Hebrew Date / Period'}</label>
                  <input
                    className="input w-full"
                    value={form.hebrewDateText}
                    onChange={e => setForm(f => ({ ...f, hebrewDateText: e.target.value }))}
                    placeholder={he ? "כא אדר א' תשפ\"ו / פרשת שמות" : "Hebrew date or parasha"}
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="label">{he ? 'אמצעי תשלום' : 'Payment Method'} *</label>
                <select
                  className="input w-full"
                  value={form.method === '__custom__' ? '__custom__' : form.method}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '__custom__') {
                      setForm(f => ({ ...f, method: '__custom__' }))
                      setCustomMethod('')
                    } else {
                      setForm(f => ({ ...f, method: v }))
                      setCustomMethod('')
                    }
                  }}
                  required={form.method !== '__custom__'}
                >
                  <option value="">{he ? '— בחר אמצעי —' : '— Select method —'}</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.value} value={pm.value}>{he ? pm.label_he : pm.label_en}</option>
                  ))}
                  <option value="__custom__">{he ? 'אחר...' : 'Other...'}</option>
                </select>
                {form.method === '__custom__' && (
                  <input
                    className="input w-full mt-2"
                    value={customMethod}
                    onChange={e => setCustomMethod(e.target.value)}
                    placeholder={he ? 'הקלד אמצעי תשלום...' : 'Type payment method...'}
                    required
                    autoFocus
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="label">{T.notes}</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={he ? 'פרטים נוספים...' : 'Additional details...'}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving || !form.member_id || (!form.method || (form.method === '__custom__' && !customMethod))} className="btn-primary flex-1">
                  {saving ? T.loading : T.save}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary flex-1">
                  {T.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <p className="text-lg font-medium mb-6">{T.confirmDelete}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">{T.cancel}</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">{T.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
