'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Invoice, InvoiceStatus, Member, Donor } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { Plus, FileText, Pencil, Trash2, Eye, Mail, Zap, CheckCircle } from 'lucide-react'
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
  const [editing, setEditing] = useState<Omit<Partial<Invoice>, 'items'> & { items?: Item[] }>({})
  const [saving, setSaving] = useState(false)
  // Auto-generate state
  const [showGenModal, setShowGenModal] = useState(false)
  const [genDateFrom, setGenDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [genDateTo, setGenDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [genLoading, setGenLoading] = useState(false)
  const [genResult, setGenResult] = useState<{ count: number; invoices: { id: number; member: string; total: number; email: string | null }[] } | null>(null)

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

  async function handleGenerate() {
    setGenLoading(true)
    const res = await fetch('/api/invoices/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_from: genDateFrom, date_to: genDateTo }),
    })
    const data = await res.json()
    setGenResult(data)
    setGenLoading(false)
    if (data.count > 0) load()
  }

  function sendEmailForInvoice(inv: Invoice) {
    if (!inv.member_email) return
    const subject = encodeURIComponent(`${inv.title_he} - ${inv.number || '#' + inv.id}`)
    const body = encodeURIComponent(
      `שלום,\n\nמצורפת חשבונית מספר ${inv.number || inv.id}.\nסכום: €${(inv.total ?? 0).toLocaleString()}\n\nתודה`
    )
    window.open(`mailto:${inv.member_email}?subject=${subject}&body=${body}`)
  }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const statusLabel = (s: InvoiceStatus) => ({ draft: T.draft, sent: T.sent, paid: T.paid, cancelled: T.cancelled }[s] ?? s)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText size={24} className="text-blue-600" /> {T.invoices}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setGenResult(null); setShowGenModal(true) }}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-purple-50 border border-purple-300 text-purple-800 hover:bg-purple-100 rounded-xl font-medium transition-colors"
          >
            <Zap size={15} />
            {lang === 'he' ? 'הפק לכל החברים' : 'Generate for All'}
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {T.addInvoice}
          </button>
        </div>
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
                        {inv.member_email ? (
                          <button
                            onClick={() => sendEmailForInvoice(inv)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                            title={T.sendEmail}
                          >
                            <Mail size={14} />
                          </button>
                        ) : (
                          <span className="p-1.5 text-gray-300" title={T.noEmail}>
                            <Mail size={14} />
                          </span>
                        )}
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

      {/* Auto-Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap size={20} className="text-purple-500" />
              {lang === 'he' ? 'הפקת חשבוניות לכל החברים' : 'Generate Invoices for All Members'}
            </h2>

            {genResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <CheckCircle size={20} />
                  {genResult.count} {lang === 'he' ? 'חשבוניות הופקו' : 'invoices generated'}
                </div>
                {genResult.invoices.length > 0 && (
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {genResult.invoices.map(inv => (
                      <div key={inv.id} className="px-4 py-2 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{inv.member}</span>
                          <span className="text-gray-500 ms-2">{fmt(inv.total)}</span>
                        </div>
                        <div className="flex gap-1">
                          <Link href={`/invoices/${inv.id}`} target="_blank" className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                            <Eye size={13} />
                          </Link>
                          {inv.email && (
                            <button
                              onClick={() => {
                                const s = encodeURIComponent(`חשבונית - ${inv.member}`)
                                const b = encodeURIComponent(`שלום,\n\nמצורפת חשבונית.\nסכום: €${inv.total.toLocaleString()}\n\nתודה`)
                                window.open(`mailto:${inv.email}?subject=${s}&body=${b}`)
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Mail size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {genResult.count === 0 && (
                  <p className="text-gray-500 text-sm">{lang === 'he' ? 'לא נמצאו חיובים לתקופה זו.' : 'No charges found for this period.'}</p>
                )}
                <button onClick={() => setShowGenModal(false)} className="btn-secondary w-full">{T.cancel}</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  {lang === 'he'
                    ? 'בחר תקופה. המערכת תיצור חשבונית לכל חבר שיש לו חיובים בתקופה זו.'
                    : 'Select a date range. An invoice will be created for each member with charges in that period.'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{lang === 'he' ? 'מתאריך' : 'From Date'}</label>
                    <input type="date" className="input w-full" value={genDateFrom} onChange={e => setGenDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'he' ? 'עד תאריך' : 'To Date'}</label>
                    <input type="date" className="input w-full" value={genDateTo} onChange={e => setGenDateTo(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button className="btn-secondary" onClick={() => setShowGenModal(false)}>{T.cancel}</button>
                  <button
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2"
                    onClick={handleGenerate}
                    disabled={genLoading}
                  >
                    <Zap size={16} />
                    {genLoading ? T.loading : (lang === 'he' ? 'הפק חשבוניות' : 'Generate Invoices')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
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
              <div className="col-span-2">
                <label className="label">{T.invoiceTitle} *</label>
                <input className="input w-full" value={editing.title_he || ''} onChange={e => setEditing(p => ({ ...p, title_he: e.target.value, title_en: e.target.value }))} />
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
                    <div className="col-span-7">
                      <input className="input w-full text-sm" placeholder={T.description} value={item.description_he}
                        onChange={e => { updateItem(idx, 'description_he', e.target.value); updateItem(idx, 'description_en', e.target.value) }} />
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
