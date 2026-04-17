'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Plus, Pencil, Trash2, Tag, ArrowRight } from 'lucide-react'

type LabelOverrideRow = {
  id: number
  original_text: string
  replacement_text: string
  notes: string | null
}

const EMPTY = { original_text: '', replacement_text: '', notes: '' }

export default function LabelsPage() {
  const { T, lang, isRTL } = useLang()
  const [rows, setRows] = useState<LabelOverrideRow[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<LabelOverrideRow>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [inputMode, setInputMode] = useState<'list' | 'custom'>('list')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/labels').then(r => r.json()).catch(() => []),
      fetch('/api/labels/suggestions').then(r => r.json()).catch(() => []),
    ])
    setRows(Array.isArray(r1) ? r1 : [])
    setSuggestions(Array.isArray(r2) ? r2 : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing({ ...EMPTY })
    setInputMode('list')
    setError('')
    setShowModal(true)
  }

  function openEdit(row: LabelOverrideRow) {
    setEditing({ ...row })
    setInputMode('custom')
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!editing.original_text?.trim() || !editing.replacement_text?.trim()) {
      setError(lang === 'he' ? 'יש למלא את שני השדות' : 'Both fields are required')
      return
    }
    setSaving(true)
    setError('')
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/labels/${editing.id}` : '/api/labels'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_text: editing.original_text,
        replacement_text: editing.replacement_text,
        notes: editing.notes || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || (lang === 'he' ? 'שגיאה בשמירה' : 'Save failed'))
      return
    }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm(T.confirmDelete)) return
    await fetch(`/api/labels/${id}`, { method: 'DELETE' })
    load()
  }

  const usedOriginals = new Set(rows.map(r => r.original_text))
  const availableSuggestions = suggestions.filter(s => !usedOriginals.has(s) || s === editing.original_text)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Tag size={24} className="text-purple-500" /> {T.labelOverrides}
        </h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {T.addLabel}
        </button>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500 mb-4">{T.labelHint}</p>

        {loading ? (
          <div className="text-center py-8 text-gray-400">{T.loading}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{T.noLabels}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.originalText}</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-600 w-10"></th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600">{T.replacementText}</th>
                  <th className="text-start py-2 px-3 font-semibold text-gray-600 hidden sm:table-cell">{T.notes}</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-700">{r.original_text}</td>
                    <td className="py-3 px-3 text-center text-gray-400">
                      <ArrowRight size={14} className={isRTL ? 'rotate-180 inline' : 'inline'} />
                    </td>
                    <td className="py-3 px-3 font-semibold text-purple-700">{r.replacement_text}</td>
                    <td className="py-3 px-3 text-gray-500 hidden sm:table-cell">{r.notes || '—'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <h2 className="text-lg font-bold">{editing.id ? T.editLabel : T.addLabel}</h2>

            <div>
              <label className="label">{T.originalText} *</label>
              {!editing.id && (
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('list')}
                    className={`text-xs px-3 py-1 rounded-lg ${inputMode === 'list' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {T.chooseFromList}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('custom')}
                    className={`text-xs px-3 py-1 rounded-lg ${inputMode === 'custom' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {T.typeCustom}
                  </button>
                </div>
              )}
              {inputMode === 'list' && !editing.id ? (
                <select
                  className="input w-full"
                  value={editing.original_text || ''}
                  onChange={e => setEditing(p => ({ ...p, original_text: e.target.value, replacement_text: p.replacement_text || e.target.value }))}
                >
                  <option value="">—</option>
                  {availableSuggestions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input w-full"
                  value={editing.original_text || ''}
                  onChange={e => setEditing(p => ({ ...p, original_text: e.target.value }))}
                  placeholder={lang === 'he' ? 'למשל: פרשת ויקהלפקודי' : 'e.g., פרשת ויקהלפקודי'}
                />
              )}
            </div>

            <div>
              <label className="label">{T.replacementText} *</label>
              <input
                className="input w-full"
                value={editing.replacement_text || ''}
                onChange={e => setEditing(p => ({ ...p, replacement_text: e.target.value }))}
                placeholder={lang === 'he' ? 'למשל: פרשת ויקהל-פקודי' : 'e.g., פרשת ויקהל-פקודי'}
              />
            </div>

            <div>
              <label className="label">{T.notes}</label>
              <input
                className="input w-full"
                value={editing.notes || ''}
                onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>{T.cancel}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? T.loading : T.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
