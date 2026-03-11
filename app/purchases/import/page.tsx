'use client'
import { useState, useRef } from 'react'
import { useLang } from '@/lib/LangContext'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, ArrowRight, FileSpreadsheet, AlertCircle } from 'lucide-react'

export default function PurchasesImportPage() {
  const { T, lang, isRTL } = useLang()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; total: number; skipped?: string[] } | null>(null)
  const [error, setError] = useState('')

  const he = lang === 'he'

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/purchases/import', { method: 'POST', body: fd })
    const data = await r.json()
    setUploading(false)
    if (data.imported > 0) {
      setResult(data)
    } else if (!r.ok || data.error) {
      setError(data.error || T.error)
      if (data.skipped?.length) setResult(data)
    } else {
      setResult(data)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/purchases')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSpreadsheet size={24} className="text-orange-600" />
          {he ? 'ייבוא רכישות מ-Excel' : 'Import Purchases from Excel'}
        </h1>
      </div>

      {/* Instructions */}
      <div className="card bg-orange-50 border border-orange-200">
        <h3 className="font-semibold text-orange-800 mb-2">{he ? 'הוראות' : 'Instructions'}</h3>
        <p className="text-sm text-orange-700 mb-3">
          {he
            ? 'העלה קובץ Excel (.xlsx, .xls) או CSV עם עמודות הרכישות. שם/חבר וסכום הם שדות חובה. שם יכול להיות חבר קיים במערכת או שם חופשי (יופיע בדף חשבון).'
            : 'Upload an Excel (.xlsx, .xls) or CSV file. Name/Member and amount are required. Name can be an existing member or a free-text name (will appear on statements).'}
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-orange-200">
                <th className="text-start py-1 px-2 text-orange-700">{he ? 'עמודה' : 'Column'}</th>
                <th className="text-start py-1 px-2 text-orange-700">{he ? 'שמות אפשריים' : 'Accepted names'}</th>
                <th className="text-start py-1 px-2 text-orange-700">{he ? 'חובה' : 'Required'}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { col: he ? 'חבר / שם' : 'Member / Name', names: 'member, חבר, שם, name', req: true },
                { col: he ? 'סכום' : 'Amount', names: 'amount, סכום, sum, price, מחיר', req: true },
                { col: he ? 'פריט' : 'Item', names: 'item, פריט, category, קטגוריה, סוג', req: false },
                { col: he ? 'שבוע / חג' : 'Week / Holiday', names: 'week, שבוע, חג, holiday, period, תקופה', req: false },
                { col: he ? 'הערות' : 'Notes', names: 'notes, הערות', req: false },
              ].map(r => (
                <tr key={r.col} className="border-b border-orange-100">
                  <td className="py-1 px-2 font-medium text-orange-800">{r.col}</td>
                  <td className="py-1 px-2 text-orange-600 font-mono">{r.names}</td>
                  <td className="py-1 px-2 font-bold">{r.req ? <span className="text-green-600">&#10003;</span> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload */}
      <div className="card">
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium">
            {file ? file.name : (he ? 'גרור קובץ לכאן או לחץ לבחירה' : 'Drag a file here or click to select')}
          </p>
          <p className="text-gray-400 text-sm mt-1">.xlsx, .xls, .csv</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />

        {file && (
          <div className="mt-4 flex justify-end">
            <button onClick={handleUpload} disabled={uploading} className="btn-primary flex items-center gap-2">
              <Upload size={16} />
              {uploading ? T.loading : (he ? 'ייבא רכישות' : 'Import Purchases')}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
              <CheckCircle size={18} />
              {he ? 'הייבוא הושלם בהצלחה' : 'Import completed successfully'}
            </div>
            <p className="text-sm text-green-700">
              {he
                ? `יובאו ${result.imported} מתוך ${result.total} רכישות`
                : `Imported ${result.imported} of ${result.total} purchases`}
            </p>
            {result.skipped && result.skipped.length > 0 && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 max-h-32 overflow-y-auto">
                <p className="font-semibold mb-1">{he ? 'שגיאות:' : 'Errors:'}</p>
                {result.skipped.map((s, i) => <div key={i}>{s}</div>)}
              </div>
            )}
            <button onClick={() => router.push('/purchases')} className="btn-primary mt-3 text-sm">
              {he ? 'חזרה לרכישות' : 'Back to Purchases'} &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
