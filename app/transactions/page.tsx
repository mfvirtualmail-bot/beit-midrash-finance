'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import Link from 'next/link'
import type { Transaction, Category } from '@/lib/db'

const COLORS = ['#22c55e','#16a34a','#ef4444','#dc2626','#f97316','#a855f7','#f59e0b','#3b82f6','#6b7280','#14b8a6']

const emptyForm = {
  type: 'income' as 'income' | 'expense' | 'purchase',
  amount: '',
  description_he: '',
  description_en: '',
  category_id: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
}

export default function TransactionsPage() {
  const { T, lang } = useLang()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ type: '', category: '', month: '', search: '' })
  const [selected, setSelected] = useState<Set<number>>(new Set())

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === txns.length ? new Set() : new Set(txns.map(t => t.id)))
  }
  async function deleteSelected() {
    if (!confirm(T.confirmDelete)) return
    // Only delete real transactions, not member payment entries
    const realIds = Array.from(selected).filter(id => !String(id).startsWith('payment-'))
    await Promise.all(realIds.map(id => fetch(`/api/transactions/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    loadData()
  }

  const fmt = (n: number) =>
    `${T.currency}${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.type) params.set('type', filters.type)
    if (filters.category) params.set('category', filters.category)
    if (filters.month) params.set('month', filters.month)
    if (filters.search) params.set('search', filters.search)
    params.set('limit', '500')

    const [txRes, catRes] = await Promise.all([
      fetch(`/api/transactions?${params}`).then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ])
    setTxns(txRes)
    setCategories(catRes)
    setLoading(false)
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    setForm({
      type: tx.type,
      amount: String(tx.amount),
      description_he: tx.description_he || '',
      description_en: tx.description_en || '',
      category_id: tx.category_id ? String(tx.category_id) : '',
      date: tx.date,
      notes: tx.notes || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.amount || !form.date) return
    setSaving(true)
    const body = {
      ...form,
      amount: parseFloat(form.amount),
      category_id: form.category_id ? parseInt(form.category_id) : null,
      description_en: form.description_he,
    }
    if (editing) {
      await fetch(`/api/transactions/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    loadData()
  }

  const filteredCats = categories.filter(c => c.type === form.type)

  const totalIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{T.transactions}</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addTransaction}
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select className="input" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">{T.all}</option>
            <option value="income">{T.income}</option>
            <option value="expense">{T.expense}</option>
          </select>
          <select className="input" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="">{T.all} {T.categories}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{lang === 'he' ? c.name_he : c.name_en}</option>
            ))}
          </select>
          <input type="month" className="input" value={filters.month} onChange={e => setFilters(f => ({ ...f, month: e.target.value }))} />
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400" />
            <input
              type="text" className="input ps-8" placeholder={T.search}
              value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">{T.income}</p>
          <p className="text-lg font-bold text-green-600">{fmt(totalIncome)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">{T.expense}</p>
          <p className="text-lg font-bold text-red-600">{fmt(totalExpense)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">{T.balance}</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {fmt(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
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

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="text-center py-12 text-gray-400">{T.loading}</div>
        ) : txns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">{T.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-2 py-3 w-10">
                    <input type="checkbox" checked={selected.size === txns.length && txns.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-start">{T.date}</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-start">{T.type}</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-start">{T.description}</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-start">{T.category}</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-end">{T.amount}</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-center">{T.edit}/{T.delete}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {txns.map(tx => (
                  <tr key={tx.id} className={`hover:bg-gray-50 ${selected.has(tx.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-3">
                      <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{tx.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {tx.type === 'income' ? T.income : T.expense}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {lang === 'he' ? (tx.description_he || tx.description_en || '—') : (tx.description_en || tx.description_he || '—')}
                    </td>
                    <td className="px-4 py-3">
                      {tx.category_name_he ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: tx.category_color || '#6b7280' }}>
                          {lang === 'he' ? tx.category_name_he : tx.category_name_en}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-3 font-semibold text-end ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {String(tx.id).startsWith('payment-') ? (
                        <Link href={`/members/${tx.member_id}`} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">{lang === 'he' ? 'תשלום חבר →' : 'Payment →'}</Link>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(tx)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(tx.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editing ? T.editTransaction : T.addTransaction}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="label">{T.type}</label>
                <div className="flex gap-3">
                  {(['income', 'expense'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors
                        ${form.type === t
                          ? t === 'income' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {t === 'income' ? T.income : T.expense}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="label">{T.amount} ({T.currency})</label>
                <input type="number" className="input" min="0" step="0.01"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              {/* Date */}
              <div>
                <label className="label">{T.date}</label>
                <input type="date" className="input"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              {/* Category */}
              <div>
                <label className="label">{T.category}</label>
                <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">— {T.category} —</option>
                  {filteredCats.map(c => (
                    <option key={c.id} value={c.id}>{lang === 'he' ? c.name_he : c.name_en}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="label">{T.description}</label>
                <input className="input" value={form.description_he} onChange={e => setForm(f => ({ ...f, description_he: e.target.value }))} />
              </div>

              {/* Notes */}
              <div>
                <label className="label">{T.notes}</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">{T.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? T.loading : T.save}
              </button>
            </div>
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
