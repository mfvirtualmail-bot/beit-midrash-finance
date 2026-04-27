'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { ListChecks, Plus, Trash2, Save, ChevronLeft, AlertCircle, CheckCircle, GripVertical } from 'lucide-react'
import Link from 'next/link'

interface TemplateItem {
  id?: number
  label_he: string
}

interface PurchaseTemplate {
  id: number
  template_key: string
  label_he: string
  sort_order: number
  items: TemplateItem[]
}

export default function PurchaseTemplatesPage() {
  const { T, lang } = useLang()
  const [templates, setTemplates] = useState<PurchaseTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [draft, setDraft] = useState<PurchaseTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/purchase-templates')
    const data = await res.json()
    if (Array.isArray(data)) {
      setTemplates(data)
      if (data.length > 0 && activeId === null) {
        setActiveId(data[0].id)
        setDraft(JSON.parse(JSON.stringify(data[0])))
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function selectTemplate(id: number) {
    const t = templates.find(x => x.id === id)
    if (!t) return
    setActiveId(id)
    setDraft(JSON.parse(JSON.stringify(t)))
    setMsg(null)
  }

  function updateDraftItem(idx: number, label: string) {
    if (!draft) return
    const items = [...draft.items]
    items[idx] = { ...items[idx], label_he: label }
    setDraft({ ...draft, items })
  }

  function addDraftItem() {
    if (!draft) return
    setDraft({ ...draft, items: [...draft.items, { label_he: '' }] })
  }

  function removeDraftItem(idx: number) {
    if (!draft) return
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })
  }

  function moveDraftItem(idx: number, dir: -1 | 1) {
    if (!draft) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= draft.items.length) return
    const items = [...draft.items]
    const tmp = items[idx]
    items[idx] = items[newIdx]
    items[newIdx] = tmp
    setDraft({ ...draft, items })
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/purchase-templates/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_key: draft.template_key,
        label_he: draft.label_he,
        items: draft.items.filter(i => i.label_he.trim()),
      }),
    })
    if (res.ok) {
      setMsg({ type: 'ok', text: lang === 'he' ? 'נשמר בהצלחה' : 'Saved' })
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setMsg({ type: 'err', text: d.error ?? T.error })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 4000)
  }

  async function deleteTemplate() {
    if (!draft) return
    if (!confirm(lang === 'he' ? 'למחוק את התבנית? פעולה זו אינה ניתנת לביטול.' : 'Delete this template? This cannot be undone.')) return
    const res = await fetch(`/api/purchase-templates/${draft.id}`, { method: 'DELETE' })
    if (res.ok) {
      setActiveId(null)
      setDraft(null)
      await load()
    }
  }

  async function createTemplate() {
    if (!newKey.trim() || !newLabel.trim()) return
    const res = await fetch('/api/purchase-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_key: newKey.trim(),
        label_he: newLabel.trim(),
        items: [],
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setShowNew(false)
      setNewKey('')
      setNewLabel('')
      await load()
      setActiveId(created.id)
      setDraft({ ...created, items: [] })
    } else {
      const d = await res.json().catch(() => ({}))
      setMsg({ type: 'err', text: d.error ?? T.error })
      setTimeout(() => setMsg(null), 4000)
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">{T.loading}</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ListChecks size={24} className="text-orange-500" />
          {lang === 'he' ? 'תבניות פריטי רכישה' : 'Purchase Item Templates'}
        </h1>
        <Link
          href="/settings"
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft size={16} className={lang === 'he' ? 'rotate-180' : ''} />
          {lang === 'he' ? 'חזרה להגדרות' : 'Back to Settings'}
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        {lang === 'he'
          ? 'הגדר רשימת פריטים מומלצת לכל סוג יום (שבת, יום טוב וכו׳). בעמוד הרכישות, כשתבחר תאריך שמתאים לתבנית — הפריטים יוצגו אוטומטית בטבלה.'
          : 'Define a recommended item list for each day type (Shabbat, Yom Tov, etc.). On the Purchases page, picking a date that matches a template auto-fills the items table.'}
      </p>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template list */}
        <div className="card space-y-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">
              {lang === 'he' ? 'תבניות' : 'Templates'} ({templates.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowNew(s => !s)}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100 rounded-lg font-medium"
            >
              <Plus size={12} />
              {lang === 'he' ? 'חדש' : 'New'}
            </button>
          </div>

          {showNew && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2 mb-2">
              <input
                dir="rtl"
                className="input w-full text-sm"
                placeholder={lang === 'he' ? 'מזהה (למשל: shabbat, יום כיפור)' : 'Key (e.g. shabbat, יום כיפור)'}
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
              />
              <input
                dir="rtl"
                className="input w-full text-sm"
                placeholder={lang === 'he' ? 'שם תצוגה' : 'Display label'}
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                {lang === 'he'
                  ? 'המזהה חייב להיות בדיוק כפי ששם החג מופיע בלוח (ללא ניקוד). ל-שבת השתמש ב-shabbat.'
                  : 'Key must exactly match the holiday name as shown in the calendar (without nikud). For Shabbat use "shabbat".'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createTemplate}
                  disabled={!newKey.trim() || !newLabel.trim()}
                  className="btn-primary text-xs flex-1 disabled:opacity-40"
                >
                  {lang === 'he' ? 'צור' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNew(false); setNewKey(''); setNewLabel('') }}
                  className="btn-secondary text-xs"
                >
                  {T.cancel}
                </button>
              </div>
            </div>
          )}

          {templates.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">
              {lang === 'he' ? 'אין תבניות עדיין' : 'No templates yet'}
            </p>
          )}
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTemplate(t.id)}
              className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${activeId === t.id ? 'bg-orange-100 text-orange-900 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <div className="font-medium" dir="rtl">{t.label_he}</div>
              <div className="text-xs text-gray-500 font-mono truncate" dir="ltr">{t.template_key}</div>
              <div className="text-xs text-gray-400">{t.items.length} {lang === 'he' ? 'פריטים' : 'items'}</div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="card md:col-span-2 space-y-4">
          {!draft && (
            <p className="text-center text-gray-400 py-8 text-sm">
              {lang === 'he' ? 'בחר תבנית לעריכה' : 'Select a template to edit'}
            </p>
          )}
          {draft && (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base font-semibold text-gray-700">
                  {lang === 'he' ? 'עריכת תבנית' : 'Edit Template'}
                </h2>
                <button
                  type="button"
                  onClick={deleteTemplate}
                  className="flex items-center gap-1 text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={12} />
                  {lang === 'he' ? 'מחק תבנית' : 'Delete template'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">{lang === 'he' ? 'מזהה' : 'Key'}</label>
                  <input
                    dir="rtl"
                    className="input w-full text-sm"
                    value={draft.template_key}
                    onChange={e => setDraft({ ...draft, template_key: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label text-xs">{lang === 'he' ? 'שם תצוגה' : 'Display Label'}</label>
                  <input
                    dir="rtl"
                    className="input w-full text-sm"
                    value={draft.label_he}
                    onChange={e => setDraft({ ...draft, label_he: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {lang === 'he' ? 'פריטים' : 'Items'} ({draft.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addDraftItem}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-lg"
                  >
                    <Plus size={12} />
                    {lang === 'he' ? 'הוסף פריט' : 'Add item'}
                  </button>
                </div>
                {draft.items.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">
                    {lang === 'he' ? 'אין פריטים — הוסף פריט ראשון' : 'No items — add the first one'}
                  </p>
                )}
                {draft.items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveDraftItem(idx, -1)}
                        disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs"
                      >▲</button>
                      <button
                        type="button"
                        onClick={() => moveDraftItem(idx, 1)}
                        disabled={idx === draft.items.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs"
                      >▼</button>
                    </div>
                    <GripVertical size={14} className="text-gray-300" />
                    <input
                      dir="rtl"
                      className="input flex-1 text-sm"
                      value={it.label_he}
                      onChange={e => updateDraftItem(idx, e.target.value)}
                      placeholder={lang === 'he' ? 'שם הפריט' : 'Item label'}
                    />
                    <button
                      type="button"
                      onClick={() => removeDraftItem(idx)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save size={14} />
                  {saving ? T.loading : T.save}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
