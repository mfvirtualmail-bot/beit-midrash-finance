'use client'
import { useState, useRef } from 'react'
import { useLang } from '@/lib/LangContext'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, ArrowRight, FileSpreadsheet } from 'lucide-react'

export default function MembersImportPage() {
  const { T, lang, isRTL } = useLang()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; total: number; skipped?: string[] } | null>(null)
  const [error, setError] = useState('')

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/members/import', { method: 'POST', body: fd })
    const data = await r.json()
    setUploading(false)
    if (!r.ok || data.error) { setError(data.error || T.error); return }
    setResult(data)
  }

  const he = lang === 'he'

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/members')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSpreadsheet size={24} className="text-green-600" />
          {he ? 'ייבוא חברים מ-Excel / CSV' : 'Import Members from Excel / CSV'}
        </h1>
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">{he ? 'הוראות' : 'Instructions'}</h3>
        <p className="text-sm text-blue-700 mb-3">
          {he
            ? 'העלה קובץ Excel (.xlsx, .xls) או CSV עם העמודות הבאות. שם הוא שדה חובה.'
            : 'Upload an Excel (.xlsx, .xls) or CSV file with the columns below. Name is required.'}
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-blue-200">
                <th className="text-start py-1 px-2 text-blue-700">{he ? 'עמודה' : 'Column'}</th>
                <th className="text-start py-1 px-2 text-blue-700">{he ? 'שמות אפשריים' : 'Accepted names'}</th>
                <th className="text-start py-1 px-2 text-blue-700">{he ? 'חובה' : 'Required'}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { col: he ? 'שם' : 'Name', names: 'name, שם, fullname, שם מלא', req: '✓' },
                { col: he ? 'טלפון' : 'Phone', names: 'phone, טלפון, mobile, נייד', req: '' },
                { col: 'Email', names: 'email, אימייל, mail', req: '' },
                { col: he ? 'כתובת' : 'Address', names: 'address, כתובת', req: '' },
                { col: he ? 'הערות' : 'Notes', names: 'notes, הערות', req: '' },
              ].map(r => (
                <tr key={r.col} className="border-b border-blue-100">
                  <td className="py-1 px-2 font-medium text-blue-800">{r.col}</td>
                  <td className="py-1 px-2 text-blue-600 font-mono">{r.names}</td>
                  <td className="py-1 px-2 text-green-600 font-bold">{r.req}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload */}
      <div className="card">
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
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
              {uploading ? T.loading : (he ? 'ייבא חברים' : 'Import Members')}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
              <CheckCircle size={18} />
              {he ? 'הייבוא הושלם בהצלחה' : 'Import completed successfully'}
            </div>
            <p className="text-sm text-green-700">
              {he
                ? `יובאו ${result.imported} מתוך ${result.total} חברים`
                : `Imported ${result.imported} of ${result.total} members`}
            </p>
            {result.skipped && result.skipped.length > 0 && (
              <p className="text-xs text-yellow-700 mt-1">{he ? 'שגיאות: ' : 'Errors: '}{result.skipped.join(', ')}</p>
            )}
            <button onClick={() => router.push('/members')} className="btn-primary mt-3 text-sm">
              {T.members} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
