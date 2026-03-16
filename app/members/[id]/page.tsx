'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Phone, Mail, MapPin, FileText, Pencil, X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
// hebrewDate utils no longer needed in this page (generate modal removed)
import Link from 'next/link'

interface MemberDetail {
  member: {
    id: number; name: string; phone: string | null; email: string | null
    address: string | null; notes: string | null
    total_charges: number; total_payments: number; balance: number
  }
  charges: Array<{ id: number; description: string; amount: number; date: string; notes: string | null; created_by_name: string | null }>
  payments: Array<{ id: number; amount: number; date: string; method: string; reference: string | null; notes: string | null; created_by_name: string | null }>
  purchases: Array<{ id: number; date: string; amount: number; type: string; description: string; category_name: string; notes: string | null }>
}

const TODAY = new Date().toISOString().slice(0, 10)

export default function MemberDetailPage() {
  const { T, lang } = useLang()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Charge form
  const [showCharge, setShowCharge] = useState(false)
  const [charge, setCharge] = useState({ description: '', amount: '', date: TODAY, notes: '' })
  const [savingCharge, setSavingCharge] = useState(false)

  // Payment form (add/edit)
  const [showPayment, setShowPayment] = useState(false)
  const [editingPayment, setEditingPayment] = useState<{ id: number; member_id: number } | null>(null)
  const [payment, setPayment] = useState({ amount: '', date: TODAY, method: '', reference: '', notes: '' })
  const [savingPayment, setSavingPayment] = useState(false)

  // (Generate invoice modal removed — now using dynamic statement view)

  const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/members/${id}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // (Auto-open logic removed — using /invoices?view=id now)

  async function addCharge(e: React.FormEvent) {
    e.preventDefault()
    setSavingCharge(true)
    const res = await fetch(`/api/members/${id}/charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...charge, amount: Number(charge.amount) }),
    })
    if (res.ok) { setShowCharge(false); setCharge({ description: '', amount: '', date: TODAY, notes: '' }); load() }
    setSavingCharge(false)
  }

  async function deleteCharge(chargeId: number) {
    await fetch(`/api/members/${id}/charges/${chargeId}`, { method: 'DELETE' })
    load()
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault()
    setSavingPayment(true)
    const body = {
      amount: Number(payment.amount),
      date: payment.date || undefined,
      method: payment.method,
      reference: payment.reference || null,
      notes: payment.notes || null,
    }
    if (editingPayment) {
      await fetch(`/api/members/${id}/payments/${editingPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch(`/api/members/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setShowPayment(false)
    setEditingPayment(null)
    setPayment({ amount: '', date: TODAY, method: '', reference: '', notes: '' })
    load()
    setSavingPayment(false)
  }

  function openEditPayment(p: { id: number; amount: number; date: string; method: string; reference: string | null; notes: string | null }) {
    setEditingPayment({ id: p.id, member_id: Number(id) })
    setPayment({
      amount: String(p.amount),
      date: p.date,
      method: p.method || '',
      reference: p.reference || '',
      notes: p.notes || '',
    })
    setShowPayment(true)
  }

  async function deletePayment(paymentId: number) {
    await fetch(`/api/members/${id}/payments/${paymentId}`, { method: 'DELETE' })
    load()
  }

  const methodLabel = (m: string | null) => {
    if (!m) return '—'
    if (m === 'cash') return T.cash
    if (m === 'bank') return T.bankTransfer
    if (m === 'check') return T.check
    if (m === 'credit_card') return lang === 'he' ? 'כרטיס אשראי' : 'Credit Card'
    if (m === 'unknown') return T.unknown
    return m
  }

  if (loading) return <div className="p-8 text-center text-gray-400">{T.loading}</div>
  if (!data) return <div className="p-8 text-center text-red-500">{T.error}</div>
  const { member, charges, payments, purchases } = data

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/members')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{member.name}</h1>
          <div className="flex gap-3 text-sm text-gray-500 mt-0.5">
            {member.phone && <span className="flex items-center gap-1"><Phone size={12} />{member.phone}</span>}
            {member.email && <span className="flex items-center gap-1"><Mail size={12} />{member.email}</span>}
            {member.address && <span className="flex items-center gap-1"><MapPin size={12} />{member.address}</span>}
          </div>
        </div>
        <Link
          href={`/invoices?view=${id}`}
          className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-50 border border-blue-300 text-blue-800 hover:bg-blue-100 rounded-xl font-medium transition-colors"
        >
          <FileText size={15} />
          {lang === 'he' ? 'צפה בדף חשבון' : 'View Statement'}
        </Link>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500">{T.totalCharges}</p>
          <p className="text-xl font-bold text-red-600">{fmt(member.total_charges)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">{T.totalPayments}</p>
          <p className="text-xl font-bold text-green-600">{fmt(member.total_payments)}</p>
        </div>
        <div className="card text-center border-2 border-blue-100">
          <p className="text-xs text-gray-500">{T.balance}</p>
          <p className={`text-xl font-bold ${member.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {member.balance < 0 ? `-${fmt(member.balance)}` : `+${fmt(member.balance)}`}
          </p>
          <p className="text-xs mt-0.5">{member.balance < 0 ? T.owes : T.credit}</p>
        </div>
      </div>

      {/* Charges section */}
      <div className="card p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">{T.charges} ({charges.length})</h2>
          <button onClick={() => setShowCharge(true)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
            <Plus size={14} /> {T.addCharge}
          </button>
        </div>
        {charges.length === 0 ? (
          <p className="p-6 text-center text-gray-400 text-sm">{T.noData}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-start">{T.date}</th>
                <th className="px-4 py-2 text-start">{T.description}</th>
                <th className="px-4 py-2 text-end">{T.amount}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {charges.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{c.date}</td>
                  <td className="px-4 py-2 text-gray-800">
                    {c.description}
                    {c.notes && <div className="text-xs text-gray-400">{c.notes}</div>}
                  </td>
                  <td className="px-4 py-2 text-end font-medium text-red-600">{fmt(c.amount)}</td>
                  <td className="px-4 py-2 text-end">
                    <button onClick={() => deleteCharge(c.id)} className="p-1 hover:bg-red-100 text-red-400 rounded"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Purchases section */}
      {purchases && purchases.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">{lang === 'he' ? 'רכישות' : 'Purchases'} ({purchases.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-start">{T.date}</th>
                <th className="px-4 py-2 text-start">{T.description}</th>
                <th className="px-4 py-2 text-start hidden sm:table-cell">{T.notes}</th>
                <th className="px-4 py-2 text-end">{T.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{p.date}</td>
                  <td className="px-4 py-2 text-gray-800">{p.description || p.category_name}</td>
                  <td className="px-4 py-2 text-gray-400 hidden sm:table-cell">{p.notes || '—'}</td>
                  <td className="px-4 py-2 text-end font-medium text-orange-600">{fmt(p.amount)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={3} className="px-4 py-2 text-gray-600">{T.total}</td>
                <td className="px-4 py-2 text-end text-orange-600">{fmt(purchases.reduce((s, p) => s + p.amount, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Payments section */}
      <div className="card p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">{T.payments} ({payments.length})</h2>
          <button onClick={() => { setEditingPayment(null); setPayment({ amount: '', date: TODAY, method: '', reference: '', notes: '' }); setShowPayment(true) }} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
            <Plus size={14} /> {T.addPayment}
          </button>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-center text-gray-400 text-sm">{T.noData}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-start">{T.date}</th>
                <th className="px-4 py-2 text-start">{T.method}</th>
                <th className="px-4 py-2 text-start hidden sm:table-cell">{T.reference}</th>
                <th className="px-4 py-2 text-end">{T.amount}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{p.date}</td>
                  <td className="px-4 py-2 text-gray-700">{methodLabel(p.method)}</td>
                  <td className="px-4 py-2 text-gray-400 hidden sm:table-cell">{p.reference || '—'}</td>
                  <td className="px-4 py-2 text-end font-medium text-green-600">{fmt(p.amount)}</td>
                  <td className="px-4 py-2 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditPayment(p)} className="p-1 hover:bg-blue-100 text-blue-500 rounded"><Pencil size={13} /></button>
                      <button onClick={() => deletePayment(p.id)} className="p-1 hover:bg-red-100 text-red-400 rounded"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Charge Modal */}
      {showCharge && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100"><h2 className="font-semibold">{T.addCharge}</h2></div>
            <form onSubmit={addCharge} className="p-5 space-y-3">
              <div>
                <label className="label">{T.description} *</label>
                <input className="input w-full" value={charge.description} onChange={e => setCharge(c => ({ ...c, description: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{T.amount} (€) *</label>
                  <input className="input w-full" type="number" step="0.01" min="0.01" value={charge.amount} onChange={e => setCharge(c => ({ ...c, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{T.date} *</label>
                  <input className="input w-full" type="date" value={charge.date} onChange={e => setCharge(c => ({ ...c, date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="label">{T.notes}</label>
                <input className="input w-full" value={charge.notes} onChange={e => setCharge(c => ({ ...c, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingCharge} className="btn-primary flex-1">{savingCharge ? T.loading : T.save}</button>
                <button type="button" onClick={() => setShowCharge(false)} className="btn-secondary flex-1">{T.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold">{editingPayment ? (lang === 'he' ? 'ערוך תשלום' : 'Edit Payment') : T.addPayment}</h2>
              <button onClick={() => { setShowPayment(false); setEditingPayment(null) }} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={savePayment} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{T.amount} (€) *</label>
                  <input className="input w-full" type="number" step="0.01" min="0.01" value={payment.amount} onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{T.date} *</label>
                  <input className="input w-full" type="date" value={payment.date} onChange={e => setPayment(p => ({ ...p, date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="label">{T.method} *</label>
                <select className="input w-full" value={payment.method} onChange={e => setPayment(p => ({ ...p, method: e.target.value }))} required>
                  <option value="">{lang === 'he' ? '— בחר אמצעי —' : '— Select method —'}</option>
                  <option value="cash">{T.cash}</option>
                  <option value="bank">{T.bankTransfer}</option>
                  <option value="check">{T.check}</option>
                  <option value="credit_card">{lang === 'he' ? 'כרטיס אשראי' : 'Credit Card'}</option>
                  <option value="unknown">{T.unknown}</option>
                </select>
              </div>
              <div>
                <label className="label">{T.reference}</label>
                <input className="input w-full" value={payment.reference} onChange={e => setPayment(p => ({ ...p, reference: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.notes}</label>
                <input className="input w-full" value={payment.notes} onChange={e => setPayment(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingPayment} className="btn-primary flex-1">{savingPayment ? T.loading : T.save}</button>
                <button type="button" onClick={() => { setShowPayment(false); setEditingPayment(null) }} className="btn-secondary flex-1">{T.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* (Generate Statement modal removed — now uses dynamic "View Statement" link to /invoices?view=id) */}
    </div>
  )
}
