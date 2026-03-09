'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Phone, Mail, MapPin } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

interface MemberDetail {
  member: {
    id: number; name: string; phone: string | null; email: string | null
    address: string | null; notes: string | null
    total_charges: number; total_payments: number; balance: number
  }
  charges: Array<{ id: number; description: string; amount: number; date: string; notes: string | null; created_by_name: string | null }>
  payments: Array<{ id: number; amount: number; date: string; method: string; reference: string | null; notes: string | null; created_by_name: string | null }>
}

const TODAY = new Date().toISOString().slice(0, 10)

export default function MemberDetailPage() {
  const { T } = useLang()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Charge form
  const [showCharge, setShowCharge] = useState(false)
  const [charge, setCharge] = useState({ description: '', amount: '', date: TODAY, notes: '' })
  const [savingCharge, setSavingCharge] = useState(false)

  // Payment form
  const [showPayment, setShowPayment] = useState(false)
  const [payment, setPayment] = useState({ amount: '', date: TODAY, method: 'cash', reference: '', notes: '' })
  const [savingPayment, setSavingPayment] = useState(false)

  const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/members/${id}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

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

  async function addPayment(e: React.FormEvent) {
    e.preventDefault()
    setSavingPayment(true)
    const res = await fetch(`/api/members/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payment, amount: Number(payment.amount) }),
    })
    if (res.ok) { setShowPayment(false); setPayment({ amount: '', date: TODAY, method: 'cash', reference: '', notes: '' }); load() }
    setSavingPayment(false)
  }

  async function deletePayment(paymentId: number) {
    await fetch(`/api/members/${id}/payments/${paymentId}`, { method: 'DELETE' })
    load()
  }

  const methodLabel = (m: string) => {
    if (m === 'cash') return T.cash
    if (m === 'bank') return T.bankTransfer
    if (m === 'check') return T.check
    return m
  }

  if (loading) return <div className="p-8 text-center text-gray-400">{T.loading}</div>
  if (!data) return <div className="p-8 text-center text-red-500">{T.error}</div>
  const { member, charges, payments } = data

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/members')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{member.name}</h1>
          <div className="flex gap-3 text-sm text-gray-500 mt-0.5">
            {member.phone && <span className="flex items-center gap-1"><Phone size={12} />{member.phone}</span>}
            {member.email && <span className="flex items-center gap-1"><Mail size={12} />{member.email}</span>}
            {member.address && <span className="flex items-center gap-1"><MapPin size={12} />{member.address}</span>}
          </div>
        </div>
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

      {/* Payments section */}
      <div className="card p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">{T.payments} ({payments.length})</h2>
          <button onClick={() => setShowPayment(true)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
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
                    <button onClick={() => deletePayment(p.id)} className="p-1 hover:bg-red-100 text-red-400 rounded"><Trash2 size={13} /></button>
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

      {/* Add Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100"><h2 className="font-semibold">{T.addPayment}</h2></div>
            <form onSubmit={addPayment} className="p-5 space-y-3">
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
                <label className="label">{T.method}</label>
                <select className="input w-full" value={payment.method} onChange={e => setPayment(p => ({ ...p, method: e.target.value }))}>
                  <option value="cash">{T.cash}</option>
                  <option value="bank">{T.bankTransfer}</option>
                  <option value="check">{T.check}</option>
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
                <button type="button" onClick={() => setShowPayment(false)} className="btn-secondary flex-1">{T.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
