'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Donor, Collector } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { ArrowRight, Plus, Trash2, Heart } from 'lucide-react'

interface Donation { id: number; donor_id: number; amount: number; date: string; description: string | null; notes: string | null; collector_id: number | null; collector_name?: string | null; collector_commission?: number | null }
interface DonorDetail extends Donor { donations: Donation[]; total_donated: number }

export default function DonorDetailPage() {
  const { T, lang, isRTL } = useLang()
  const params = useParams()
  const router = useRouter()
  const [donor, setDonor] = useState<DonorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newDonation, setNewDonation] = useState({ amount: '', date: new Date().toISOString().split('T')[0], description: '', notes: '', collector_id: '' as string })
  const [saving, setSaving] = useState(false)
  const [collectors, setCollectors] = useState<Collector[]>([])

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/donors/${params.id}`)
    if (r.ok) setDonor(await r.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/collectors').then(r => r.json()).then(setCollectors)
  }, [params.id])

  async function handleAddDonation() {
    if (!newDonation.amount || !newDonation.date) return
    setSaving(true)
    await fetch(`/api/donors/${params.id}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDonation),
    })
    setSaving(false)
    setShowAdd(false)
    setNewDonation({ amount: '', date: new Date().toISOString().split('T')[0], description: '', notes: '', collector_id: '' })
    load()
  }

  async function handleDeleteDonation(donationId: number) {
    if (!confirm(T.confirmDelete)) return
    await fetch(`/api/donors/${params.id}/donations/${donationId}`, { method: 'DELETE' })
    load()
  }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  if (loading) return <div className="text-center py-16 text-gray-400">{T.loading}</div>
  if (!donor) return <div className="text-center py-16 text-gray-400">{T.error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/donors')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart size={20} className="text-rose-500" /> {donor.name_he}
          </h1>
          {donor.name_en && <p className="text-gray-500 text-sm">{donor.name_en}</p>}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{fmt(donor.total_donated)}</div>
          <div className="text-sm text-gray-500 mt-1">{T.totalDonated}</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{donor.donations.length}</div>
          <div className="text-sm text-gray-500 mt-1">{T.donations}</div>
        </div>
        <div className="card text-center">
          <div className={`text-lg font-semibold ${donor.active ? 'text-green-600' : 'text-gray-400'}`}>
            {donor.active ? T.active : T.inactive}
          </div>
          <div className="text-sm text-gray-500 mt-1">{T.type}</div>
        </div>
      </div>

      {/* Contact info */}
      {(donor.phone || donor.email || donor.address) && (
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {donor.phone && <div><span className="text-gray-500">{T.phone}:</span> <span className="font-medium">{donor.phone}</span></div>}
            {donor.email && <div><span className="text-gray-500">{T.emailLabel}:</span> <span className="font-medium">{donor.email}</span></div>}
            {donor.address && <div><span className="text-gray-500">{T.address}:</span> <span className="font-medium">{donor.address}</span></div>}
          </div>
          {donor.notes && <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">{donor.notes}</p>}
        </div>
      )}

      {/* Donations list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{T.donations}</h2>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> {T.addDonation}
          </button>
        </div>

        {showAdd && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{T.amount} *</label>
                <input type="number" className="input w-full" value={newDonation.amount}
                  onChange={e => setNewDonation(p => ({ ...p, amount: e.target.value }))} min="0" step="0.01" />
              </div>
              <div>
                <label className="label">{T.date} *</label>
                <input type="date" className="input w-full" value={newDonation.date}
                  onChange={e => setNewDonation(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.description}</label>
                <input className="input w-full" value={newDonation.description}
                  onChange={e => setNewDonation(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.collector}</label>
                <select className="input w-full" value={newDonation.collector_id}
                  onChange={e => setNewDonation(p => ({ ...p, collector_id: e.target.value }))}>
                  <option value="">—</option>
                  {collectors.filter(c => c.active).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.commission_percent}%)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setShowAdd(false)}>{T.cancel}</button>
              <button className="btn-primary text-sm" onClick={handleAddDonation} disabled={saving || !newDonation.amount}>
                {saving ? T.loading : T.save}
              </button>
            </div>
          </div>
        )}

        {donor.donations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{T.noData}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.date}</th>
                <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.hebrewDate}</th>
                <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.description}</th>
                <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden md:table-cell">{T.collector}</th>
                <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.amount}</th>
                <th className="text-end py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.commission}</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {donor.donations.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-3 text-gray-600">{d.date}</td>
                  <td className="py-3 px-3 text-gray-500 text-xs" dir="rtl">{formatHebrewDate(d.date, 'he')}</td>
                  <td className="py-3 px-3 text-gray-600 hidden sm:table-cell">{d.description || '—'}</td>
                  <td className="py-3 px-3 text-gray-600 hidden md:table-cell">{d.collector_name || '—'}</td>
                  <td className="py-3 px-3 text-end font-semibold text-green-600">{fmt(Number(d.amount))}</td>
                  <td className="py-3 px-3 text-end text-orange-600 hidden sm:table-cell">
                    {d.collector_commission ? fmt(d.collector_commission) : '—'}
                  </td>
                  <td className="py-3 px-3 text-end">
                    <button onClick={() => handleDeleteDonation(d.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
