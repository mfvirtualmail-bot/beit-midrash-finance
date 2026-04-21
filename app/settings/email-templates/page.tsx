'use client'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { Mail, Plus, Trash2, Star, CheckCircle, AlertCircle, ArrowLeft, Save, X } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false })

interface EmailTemplate {
  id: number
  name: string
  subject: string
  body_html: string
  is_default: boolean
  sort_order: number
}

const PLACEHOLDERS = [
  { key: 'member_name', he: 'שם החבר', en: 'Member name' },
  { key: 'balance', he: 'יתרה (מעוצבת)', en: 'Balance (formatted)' },
  { key: 'balance_raw', he: 'יתרה (סכום בלבד)', en: 'Balance (raw amount)' },
  { key: 'total_charged', he: 'סה"כ חיובים', en: 'Total charged' },
  { key: 'total_paid', he: 'סה"כ תשלומים', en: 'Total paid' },
  { key: 'org_name', he: 'שם הארגון', en: 'Org name' },
  { key: 'date', he: 'תאריך היום', en: "Today's date" },
]

export default function EmailTemplatesPage() {
  const { lang } = useLang()
  const he = lang === 'he'
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/email-templates')
    const data = await res.json()
    if (Array.isArray(data)) setTemplates(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startNew() {
    setEditing({
      id: 0,
      name: he ? 'תבנית חדשה' : 'New template',
      subject: he ? 'דף חשבון - {{member_name}}' : 'Statement - {{member_name}}',
      body_html: he
        ? '<p>שלום <strong>{{member_name}}</strong>,</p><p>מצורף דף החשבון שלך. יתרה: {{balance}}.</p>'
        : '<p>Hello <strong>{{member_name}}</strong>,</p><p>Your statement is attached. Balance: {{balance}}.</p>',
      is_default: false,
      sort_order: templates.length,
    })
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    setMsg(null)
    const isNew = editing.id === 0
    const url = isNew ? '/api/email-templates' : `/api/email-templates/${editing.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editing.name,
        subject: editing.subject,
        body_html: editing.body_html,
        is_default: editing.is_default,
        sort_order: editing.sort_order,
      }),
    })
    if (res.ok) {
      setMsg({ type: 'ok', text: he ? 'התבנית נשמרה' : 'Template saved' })
      setEditing(null)
      load()
    } else {
      const d = await res.json()
      setMsg({ type: 'err', text: d.error || (he ? 'שגיאה בשמירה' : 'Save failed') })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 4000)
  }

  async function remove(t: EmailTemplate) {
    if (t.is_default) {
      setMsg({ type: 'err', text: he ? 'לא ניתן למחוק תבנית ברירת מחדל' : 'Cannot delete default template' })
      setTimeout(() => setMsg(null), 4000)
      return
    }
    if (!confirm(he ? `למחוק את התבנית "${t.name}"?` : `Delete template "${t.name}"?`)) return
    const res = await fetch(`/api/email-templates/${t.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMsg({ type: 'ok', text: he ? 'התבנית נמחקה' : 'Template deleted' })
      load()
    } else {
      const d = await res.json()
      setMsg({ type: 'err', text: d.error || (he ? 'שגיאה במחיקה' : 'Delete failed') })
    }
    setTimeout(() => setMsg(null), 4000)
  }

  async function setDefault(t: EmailTemplate) {
    const res = await fetch(`/api/email-templates/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    })
    if (res.ok) {
      setMsg({ type: 'ok', text: he ? 'ברירת המחדל עודכנה' : 'Default updated' })
      load()
    }
    setTimeout(() => setMsg(null), 3000)
  }

  function insertPlaceholder(key: string, target: 'subject' | 'body') {
    if (!editing) return
    const token = `{{${key}}}`
    if (target === 'subject') {
      setEditing({ ...editing, subject: (editing.subject || '') + token })
    } else {
      setEditing({ ...editing, body_html: (editing.body_html || '') + token })
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 flex-1">
          <Mail size={24} className="text-purple-600" />
          {he ? 'תבניות אימייל' : 'Email Templates'}
        </h1>
        {!editing && (
          <button onClick={startNew} className="flex items-center gap-2 text-sm px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-xl font-medium">
            <Plus size={14} />
            {he ? 'תבנית חדשה' : 'New Template'}
          </button>
        )}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {editing ? (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-semibold text-gray-700">
              {editing.id === 0
                ? (he ? 'תבנית חדשה' : 'New Template')
                : (he ? 'עריכת תבנית' : 'Edit Template')}
            </h2>
            <button onClick={() => setEditing(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="label">{he ? 'שם התבנית' : 'Template name'}</label>
            <input
              dir={he ? 'rtl' : 'ltr'}
              className="input w-full"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder={he ? 'לדוגמה: תבנית חודשית' : 'e.g. Monthly template'}
            />
          </div>

          <div>
            <label className="label">{he ? 'נושא המייל' : 'Email subject'}</label>
            <input
              dir={he ? 'rtl' : 'ltr'}
              className="input w-full"
              value={editing.subject}
              onChange={e => setEditing({ ...editing, subject: e.target.value })}
              placeholder={he ? 'דף חשבון - {{member_name}}' : 'Statement - {{member_name}}'}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-gray-400 mr-1">{he ? 'הכנס:' : 'Insert:'}</span>
              {PLACEHOLDERS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key, 'subject')}
                  className="text-[11px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 font-mono"
                  title={he ? p.he : p.en}
                >
                  {`{{${p.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{he ? 'גוף ההודעה' : 'Message body'}</label>
            <RichTextEditor
              value={editing.body_html}
              onChange={(html: string) => setEditing({ ...editing, body_html: html })}
              placeholder={he ? 'הקלד את תוכן ההודעה...' : 'Type message content...'}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-gray-400 mr-1">{he ? 'הכנס:' : 'Insert:'}</span>
              {PLACEHOLDERS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key, 'body')}
                  className="text-[11px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 font-mono"
                  title={he ? p.he : p.en}
                >
                  {`{{${p.key}}}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {he
                ? 'מתחת להודעה זו יתווספו אוטומטית: כרטיסי סיכום (חיובים/תשלומים/יתרה), טבלת פעילות אחרונה, וכפתור תשלום (אם רלוונטי).'
                : 'Below this message we auto-append: summary cards (charges/payments/balance), recent activity table, and a Pay Now button (if applicable).'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={editing.is_default}
              onChange={e => setEditing({ ...editing, is_default: e.target.checked })}
            />
            {he ? 'הגדר כתבנית ברירת המחדל' : 'Set as default template'}
          </label>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={save}
              disabled={saving || !editing.name.trim() || !editing.subject.trim()}
              className="flex items-center gap-2 text-sm px-5 py-2.5 bg-purple-600 text-white hover:bg-purple-700 rounded-xl font-medium disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? (he ? 'שומר...' : 'Saving...') : (he ? 'שמור' : 'Save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-medium"
            >
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-gray-400">{he ? 'טוען...' : 'Loading...'}</div>
      ) : templates.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          {he ? 'אין תבניות עדיין. לחץ "תבנית חדשה" או הפעל מיגרציה לטעינת תבניות בסיס.' : 'No templates yet. Click "New Template" or run migrations to seed starter templates.'}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="card flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">{t.name}</h3>
                  {t.is_default && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
                      <Star size={10} /> {he ? 'ברירת מחדל' : 'default'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-1 truncate">
                  <span className="text-gray-400">{he ? 'נושא: ' : 'Subject: '}</span>{t.subject}
                </p>
                <div
                  className="text-xs text-gray-600 line-clamp-2"
                  dir="rtl"
                  dangerouslySetInnerHTML={{ __html: t.body_html.replace(/<[^>]+>/g, ' ').slice(0, 200) }}
                />
              </div>
              <div className="flex gap-1 shrink-0">
                {!t.is_default && (
                  <button
                    onClick={() => setDefault(t)}
                    className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg font-medium"
                    title={he ? 'הגדר כברירת מחדל' : 'Set as default'}
                  >
                    <Star size={12} />
                  </button>
                )}
                <button
                  onClick={() => setEditing(t)}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-medium"
                >
                  {he ? 'ערוך' : 'Edit'}
                </button>
                <button
                  onClick={() => remove(t)}
                  disabled={t.is_default}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
