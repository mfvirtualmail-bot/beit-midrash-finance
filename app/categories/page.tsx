'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import type { Category } from '@/lib/db'

const COLORS = ['#22c55e','#16a34a','#15803d','#4ade80','#ef4444','#dc2626','#f97316','#a855f7','#f59e0b','#3b82f6','#6b7280','#14b8a6','#ec4899','#8b5cf6']

const emptyForm = { name_he: '', name_en: '', type: 'income' as 'income' | 'expense' | 'purchase', color: '#22c55e' }

export default function CategoriesPage() {
  const { T, lang } = useLang()
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/categories').then(r => r.json())
    setCats(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = (defaultType?: 'income' | 'expense' | 'purchase') => {
    setEditing(null)
    setForm({ ...emptyForm, type: defaultType ?? 'income', color: defaultType === 'purchase' ? '#6b7280' : '#22c55e' })
    setShowForm(true)
  }
  const openEdit = (c: Category) => {
    setEditing(c)
    setForm({ name_he: c.name_he, name_en: c.name_en, type: c.type, color: c.color })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name_he) return
    if (form.type !== 'purchase' && !form.name_en) return
    setSaving(true)
    const body = form.type === 'purchase'
      ? { name_he: form.name_he, name_en: form.name_he, type: form.type, color: '#6b7280' }
      : form
    if (editing) {
      await fetch(`/api/categories/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  const income = cats.filter(c => c.type === 'income')
  const expense = cats.filter(c => c.type === 'expense')
  const purchase = cats.filter(c => c.type === 'purchase')

  const isPurchase = form.type === 'purchase'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{T.categories}</h1>
        <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addCategory}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{T.loading}</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Income */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700">{T.income}</h2>
              <button onClick={() => openAdd('income')} className="p-1 text-green-600 hover:bg-green-50 rounded-lg" title={T.addCategory}>
                <Plus size={15} />
              </button>
            </div>
            {income.length === 0 ? (
              <p className="text-gray-400 text-center py-4">{T.noData}</p>
            ) : (
              <div className="space-y-2">
                {income.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <div>
                        <p className="font-medium text-gray-800">{c.name_he}</p>
                        <p className="text-xs text-gray-500">{c.name_en}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-white text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-white text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700">{T.expense}</h2>
              <button onClick={() => openAdd('expense')} className="p-1 text-red-500 hover:bg-red-50 rounded-lg" title={T.addCategory}>
                <Plus size={15} />
              </button>
            </div>
            {expense.length === 0 ? (
              <p className="text-gray-400 text-center py-4">{T.noData}</p>
            ) : (
              <div className="space-y-2">
                {expense.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <div>
                        <p className="font-medium text-gray-800">{c.name_he}</p>
                        <p className="text-xs text-gray-500">{c.name_en}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-white text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-white text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Types */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700">סוגי רכישות</h2>
              <button onClick={() => openAdd('purchase')} className="p-1 text-orange-500 hover:bg-orange-50 rounded-lg" title="הוסף סוג רכישה">
                <Plus size={15} />
              </button>
            </div>
            {purchase.length === 0 ? (
              <p className="text-gray-400 text-center py-4">{T.noData}</p>
            ) : (
              <div className="space-y-2">
                {purchase.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800" dir="rtl">{c.name_he}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-white text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-white text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editing ? T.editCategory : T.addCategory}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">{T.type}</label>
                <div className="flex gap-2">
                  {(['income', 'expense', 'purchase'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t, color: t === 'purchase' ? '#6b7280' : t === 'income' ? '#22c55e' : '#ef4444' }))}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium
                        ${form.type === t
                          ? t === 'income' ? 'border-green-500 bg-green-50 text-green-700'
                            : t === 'expense' ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-500'}`}>
                      {t === 'income' ? T.income : t === 'expense' ? T.expense : 'רכישות'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{T.nameHe}</label>
                <input className="input" dir="rtl" value={form.name_he} onChange={e => setForm(f => ({ ...f, name_he: e.target.value }))} />
              </div>

              {!isPurchase && (
                <div>
                  <label className="label">{T.nameEn}</label>
                  <input className="input" dir="ltr" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                </div>
              )}

              {!isPurchase && (
                <div>
                  <label className="label">{T.color}</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
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
