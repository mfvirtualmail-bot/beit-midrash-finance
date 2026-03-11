'use client'
import { useState, useEffect, useRef } from 'react'
import { useLang } from '@/lib/LangContext'
import { Settings, CheckCircle, AlertCircle, Building2, Upload, Trash2, ImageIcon, Database } from 'lucide-react'

interface OrgSettings {
  org_name_he: string
  org_name_en: string
  org_address: string
  org_phone: string
  org_email: string
  invoice_header_he: string
  invoice_header_en: string
  invoice_footer_he: string
  invoice_footer_en: string
}

const DEFAULTS: OrgSettings = {
  org_name_he: 'בית המדרש',
  org_name_en: 'Beit Midrash',
  org_address: '',
  org_phone: '',
  org_email: '',
  invoice_header_he: '',
  invoice_header_en: '',
  invoice_footer_he: '',
  invoice_footer_en: '',
}

export default function SettingsPage() {
  const { T, lang } = useLang()
  const [form, setForm] = useState<OrgSettings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [migrating, setMigrating] = useState(false)
  const [migrateMsg, setMigrateMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data && !data.error) setForm({ ...DEFAULTS, ...data })
      setLoading(false)
    })
    fetch('/api/settings/logo').then(r => r.json()).then(data => {
      if (data?.logo) setLogoPreview(data.logo)
    })
  }, [])

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: lang === 'he' ? 'יש לבחור קובץ תמונה' : 'Please select an image file' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: lang === 'he' ? 'הקובץ גדול מדי (מקסימום 2MB)' : 'File too large (max 2MB)' })
      return
    }
    setLogoUploading(true)
    setMsg(null)
    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
    if (res.ok) {
      const reader = new FileReader()
      reader.onload = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
      setMsg({ type: 'ok', text: lang === 'he' ? 'הלוגו הועלה בהצלחה' : 'Logo uploaded successfully' })
    } else {
      const d = await res.json()
      setMsg({ type: 'err', text: d.error ?? T.error })
    }
    setLogoUploading(false)
    setTimeout(() => setMsg(null), 5000)
  }

  async function handleLogoDelete() {
    if (!confirm(lang === 'he' ? 'למחוק את הלוגו?' : 'Delete logo?')) return
    setLogoUploading(true)
    await fetch('/api/settings/logo', { method: 'DELETE' })
    setLogoPreview(null)
    setLogoUploading(false)
    setMsg({ type: 'ok', text: lang === 'he' ? 'הלוגו נמחק' : 'Logo deleted' })
    setTimeout(() => setMsg(null), 5000)
  }

  async function handleMigrate() {
    setMigrating(true)
    setMigrateMsg(null)
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMigrateMsg({ type: 'ok', text: lang === 'he' ? `מיגרציה הושלמה בהצלחה — גרסה ${data.version ?? ''}` : `Migration completed — version ${data.version ?? ''}` })
      } else {
        setMigrateMsg({ type: 'err', text: data.error ?? (lang === 'he' ? 'שגיאה בביצוע מיגרציה' : 'Migration failed') })
      }
    } catch {
      setMigrateMsg({ type: 'err', text: lang === 'he' ? 'שגיאת רשת' : 'Network error' })
    }
    setMigrating(false)
    setTimeout(() => setMigrateMsg(null), 8000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setMsg({ type: 'ok', text: T.settingsSaved })
    } else {
      const d = await res.json()
      setMsg({ type: 'err', text: d.error ?? T.error })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 5000)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">{T.loading}</div>

  const f = (k: keyof OrgSettings) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Settings size={24} className="text-gray-600" />
        {T.orgSettings}
      </h1>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Logo Upload */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <ImageIcon size={16} className="text-purple-500" />
          {lang === 'he' ? 'לוגו הארגון' : 'Organization Logo'}
        </h2>
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon size={32} className="text-gray-300" />
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {lang === 'he'
                ? 'העלה לוגו שיופיע בכניסה, בדף הראשי, בחשבוניות ובכל מקום בולט. (PNG, JPG — מקסימום 2MB)'
                : 'Upload a logo to display on login, dashboard, invoices, and everywhere prominent. (PNG, JPG — max 2MB)'}
            </p>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleLogoUpload(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                disabled={logoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-xl font-medium disabled:opacity-50"
              >
                <Upload size={14} />
                {logoUploading
                  ? T.loading
                  : logoPreview
                    ? (lang === 'he' ? 'החלף לוגו' : 'Replace Logo')
                    : (lang === 'he' ? 'העלה לוגו' : 'Upload Logo')}
              </button>
              {logoPreview && (
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={handleLogoDelete}
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 rounded-xl font-medium disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {lang === 'he' ? 'מחק' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Details */}
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
            <Building2 size={16} className="text-blue-500" />
            {lang === 'he' ? 'פרטי הארגון' : 'Organization Details'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === 'he' ? 'שם (עברית)' : 'Name (Hebrew)'}</label>
              <input dir="rtl" className="input w-full" {...f('org_name_he')} />
            </div>
            <div>
              <label className="label">{lang === 'he' ? 'שם (אנגלית)' : 'Name (English)'}</label>
              <input dir="ltr" className="input w-full" {...f('org_name_en')} />
            </div>
          </div>
          <div>
            <label className="label">{T.orgAddress}</label>
            <input className="input w-full" {...f('org_address')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{T.orgPhone}</label>
              <input className="input w-full" {...f('org_phone')} />
            </div>
            <div>
              <label className="label">{T.orgEmail}</label>
              <input type="email" className="input w-full" {...f('org_email')} />
            </div>
          </div>
        </div>

        {/* Invoice Header */}
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3">
            📄 {T.invoiceHeader}
          </h2>
          <p className="text-xs text-gray-500">
            {lang === 'he'
              ? 'טקסט זה יופיע בחלק העליון של כל דף חשבון (מתחת לשם הארגון). ניתן לכלול כתובת, מספר טלפון, שעות קבלה וכד\'.'
              : 'This text appears at the top of every statement (below the org name). You can include address, phone, opening hours, etc.'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === 'he' ? 'כותרת (עברית)' : 'Header (Hebrew)'}</label>
              <textarea dir="rtl" rows={4} className="input w-full resize-none text-sm" {...f('invoice_header_he')}
                placeholder={lang === 'he' ? 'רחוב הדוגמה 1, ירושלים\nטלפון: 02-1234567' : 'Free text header in Hebrew'} />
            </div>
            <div>
              <label className="label">{lang === 'he' ? 'כותרת (אנגלית)' : 'Header (English)'}</label>
              <textarea dir="ltr" rows={4} className="input w-full resize-none text-sm" {...f('invoice_header_en')}
                placeholder="1 Example St, Jerusalem&#10;Tel: 02-1234567" />
            </div>
          </div>
        </div>

        {/* Invoice Footer */}
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3">
            📋 {T.invoiceFooter}
          </h2>
          <p className="text-xs text-gray-500">
            {lang === 'he'
              ? 'טקסט זה יופיע בתחתית כל דף חשבון. ניתן לכלול פרטי בנק, הודעות תנאים, ברכות וכד\'.'
              : 'This text appears at the bottom of every statement. Bank details, terms, blessings, etc.'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === 'he' ? 'תחתית (עברית)' : 'Footer (Hebrew)'}</label>
              <textarea dir="rtl" rows={4} className="input w-full resize-none text-sm" {...f('invoice_footer_he')}
                placeholder={lang === 'he' ? 'לתשלומים: בנק הפועלים\nסניף: 123, חשבון: 456789' : 'Free text footer in Hebrew'} />
            </div>
            <div>
              <label className="label">{lang === 'he' ? 'תחתית (אנגלית)' : 'Footer (English)'}</label>
              <textarea dir="ltr" rows={4} className="input w-full resize-none text-sm" {...f('invoice_footer_en')}
                placeholder="Bank: Hapoalim&#10;Branch: 123, Account: 456789" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full text-base py-3">
          {saving ? T.loading : T.save}
        </button>
      </form>

      {/* Database Migration */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Database size={16} className="text-orange-500" />
          {lang === 'he' ? 'עדכון מסד נתונים' : 'Database Migration'}
        </h2>
        <p className="text-xs text-gray-500">
          {lang === 'he'
            ? 'לחץ על הכפתור לאחר עדכון האפליקציה כדי ליצור טבלאות חדשות במסד הנתונים.'
            : 'Click the button after deploying updates to create new database tables.'}
        </p>
        {migrateMsg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${migrateMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {migrateMsg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {migrateMsg.text}
          </div>
        )}
        <button
          type="button"
          disabled={migrating}
          onClick={handleMigrate}
          className="flex items-center gap-2 text-sm px-5 py-2.5 bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100 rounded-xl font-medium disabled:opacity-50"
        >
          <Database size={14} />
          {migrating
            ? (lang === 'he' ? 'מעדכן...' : 'Migrating...')
            : (lang === 'he' ? 'הפעל עדכון מסד נתונים' : 'Run Database Migration')}
        </button>
      </div>
    </div>
  )
}
