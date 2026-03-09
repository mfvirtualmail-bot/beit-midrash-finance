'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Invoice, InvoiceStatus, Member, Donor } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { Plus, FileText, Pencil, Trash2, Eye, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

type Item = { description_he: string; description_en: string; quantity: number; unit_price: number; amount: number }
const EMPTY_ITEM: Item = { description_he: '', description_en: '', quantity: 1, unit_price: 0, amount: 0 }

export default function InvoicesPage() {
  const { T, lang, isRTL } = useLang()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [donors, setDonors] = useState<Donor[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Invoice> & { items?: Item[] }>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [invR, memR, donR] = await Promise.all([
      fetch(`/api/invoices${statusFilter ? `?status=${statusFilter}` : ''}`),
      fetch('/api/members'),
      fetch('/api/donors'),
    ])
    setInvoices(await invR.json())
    setMembers(await memR.json())
    setDonors(await donR.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  function openAdd() {
    setEditing({
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      title_he: '',
      title_en: '',
      items: [{ ...EMPTY_ITEM }],
    })
    setShowModal(true)
  }

  function openEdit(inv: Invoice) {
    fetch(`/api/invoices/${inv.id}`).then(r => r.json()).then(data => {
      setEditing({ ...data, items: data.items?.length ? data.items : [{ ...EMPTY_ITEM }] })
      setShowModal(true)
    })
  }

  function updateItem(idx: number, field: keyof Item, value: string | number) {
    setEditing(prev => {
      const items = [...(prev.items ?? [])]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        items[idx].amount = items[idx].quantity * items[idx].unit_price
      }
      return { ...prev, items }
    })
  }

  function addItem() { setEditing(p => ({ ...p, items: [...(p.items ?? []), { ...EMPTY_ITEM }] })) }
  function removeItem(idx: number) { setEditing(p => ({ ...p, items: (p.items ?? []).filter((_, i) => i !== idx) })) }

  const total = (editing.items ?? []).reduce((s, i) => s + Number(i.amount), 0)

  async function handleSave() {
    if (!editing.date || !editing.title_he) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/invoices/${editing.id}` : '/api/invoices'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm(T.confirmDelete)) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    load()
  }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
  const statusLabel = (s: InvoiceStatus) => ({ draft: T.draft, sent: T.sent, paid: T.paid, cancelled: T.cancelled }[s] ?? s)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText size={24} className="text-blue-600" /> {T.invoices}
        </h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addInvoice}
        </button>
      </div>

      <div className="card">
        <div className="flex gap-2 mb-4 flex-wrap">
          {['', 'draft', 'sent', 'paid', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === '' ? T.all : statusLabel(s as InvoiceStatus)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">{T.loading}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{T.noInvoices}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.invoiceNumber}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.date}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.hebrewDate}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.invoiceTitle}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden md:table-cell">{T.recipient}</th>
                  <th className="text-end py-2 px-3 font-semibold text-gray-600">{T.total}</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600">{T.invoiceStatus}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-500 font-mono text-xs">{inv.number || `#${inv.id}`}</td>
                    <td className="py-3 px-3 text-gray-600">{inv.date}</td>
                    <td className="py-3 px-3 text-gray-500 text-xs hidden sm:table-cell" dir="rtl">{formatHebrewDate(inv.date, 'he')}</td>
                    <td className="py-3 px-3 font-medium text-gray-900">{inv.title_he}</td>
                    <td className="py-3 px-3 text-gray-600 hidden md:table-cell">
                      {inv.member_name || inv.donor_name_he || '—'}
                    </td>
                    <td className="py-3 px-3 text-end font-semibold text-gray-900">{fmt(inv.total ?? 0)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/invoices/${inv.id}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title={T.printInvoice}>
                          <Eye size={14} />
                        </Link>
                        <button onClick={() => openEdit(inv)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <h2 className="text-lg font-bold">{editing.id ? T.editInvoice : T.addInvoice}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{T.invoiceNumber}</label>
                <input className="input w-full" value={editing.number || ''} onChange={e => setEditing(p => ({ ...p, number: e.target.value }))} placeholder="INV-001" />
              </div>
              <div>
                <label className="label">{T.invoiceStatus}</label>
                <select className="input w-full" value={editing.status || 'draft'} onChange={e => setEditing(p => ({ ...p, status: e.target.value as InvoiceStatus }))}>
                  {(['draft', 'sent', 'paid', 'cancelled'] as InvoiceStatus[]).map(s => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{T.invoiceDate} *</label>
                <input type="date" className="input w-full" value={editing.date || ''} onChange={e => setEditing(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.dueDate}</label>
                <input type="date" className="input w-full" value={editing.due_date || ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.nameHe} *</label>
                <input className="input w-full" dir="rtl" value={editing.title_he || ''} onChange={e => setEditing(p => ({ ...p, title_he: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.nameEn}</label>
                <input className="input w-full" dir="ltr" value={editing.title_en || ''} onChange={e => setEditing(p => ({ ...p, title_en: e.target.value }))} />
              </div>
              <div>
                <label className="label">{T.member}</label>
                <select className="input w-full" value={editing.member_id || ''} onChange={e => setEditing(p => ({ ...p, member_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">{T.all}</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{T.donor}</label>
                <select className="input w-full" value={editing.donor_id || ''} onChange={e => setEditing(p => ({ ...p, donor_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">{T.all}</option>
                  {donors.map(d => <option key={d.id} value={d.id}>{d.name_he}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">{T.notes}</label>
                <textarea className="input w-full resize-none" rows={2} value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">{T.invoiceItems}</label>
                <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <Plus size={14} /> {T.add}
                </button>
              </div>
              <div className="space-y-2">
                {(editing.items ?? []).map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <input className="input w-full text-sm" dir="rtl" placeholder={T.descriptionHe} value={item.description_he}
                        onChange={e => updateItem(idx, 'description_he', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <input className="input w-full text-sm" dir="ltr" placeholder={T.descriptionEn} value={item.description_en}
                        onChange={e => updateItem(idx, 'description_en', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className="input w-full text-sm" placeholder={T.quantity} value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} min="1" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className="input w-full text-sm" placeholder={T.unitPrice} value={item.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min="0" step="0.01" />
                    </div>
                    <div className="col-span-1 text-end">
                      <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2 text-sm font-bold text-gray-800">
                {T.total}: {fmt(total)}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>{T.cancel}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !editing.title_he || !editing.date}>
                {saving ? T.loading : T.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
