'use client'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { Settings, CheckCircle, AlertCircle, Building2 } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data && !data.error) setForm({ ...DEFAULTS, ...data })
      setLoading(false)
    })
  }, [])

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
              ? 'טקסט זה יופיע בחלק העליון של כל חשבונית (מתחת לשם הארגון). ניתן לכלול כתובת, מספר טלפון, שעות קבלה וכד\'.'
              : 'This text appears at the top of every invoice (below the org name). You can include address, phone, opening hours, etc.'}
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
              ? 'טקסט זה יופיע בתחתית כל חשבונית. ניתן לכלול פרטי בנק, הודעות תנאים, ברכות וכד\'.'
              : 'This text appears at the bottom of every invoice. Bank details, terms, blessings, etc.'}
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
    </div>
  )
}
