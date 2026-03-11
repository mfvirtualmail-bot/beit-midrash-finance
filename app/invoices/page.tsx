'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'
import { Member } from '@/lib/db'
import { getCurrentHebrewYear, getRecentHebrewYears, hebrewYearToGregorianRange } from '@/lib/hebrewDate'
import { generatePdfFromElement, generateMultiMemberPdf, downloadBlob, createPdfPreviewUrl } from '@/lib/pdfGenerator'
import { FileText, Eye, Download, Search, Zap, CheckCircle, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function StatementsPage() {
  const { T, lang } = useLang()
  const he = lang === 'he'
  const [members, setMembers] = useState<(Member & { total_fees: number; total_purchases: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Year selector
  const hebrewYears = getRecentHebrewYears()
  const [selectedYear, setSelectedYear] = useState(getCurrentHebrewYear())

  // Generate modal
  const [showGenModal, setShowGenModal] = useState(false)
  const [genMemberId, setGenMemberId] = useState<number | ''>('')
  const [genLoading, setGenLoading] = useState(false)
  const [genResult, setGenResult] = useState<{ count: number; invoices: { id: number; member: string; total: number; email: string | null }[] } | null>(null)

  // PDF preview modal
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [previewMemberIds, setPreviewMemberIds] = useState<number[]>([])
  const [previewMemberName, setPreviewMemberName] = useState('')
  const renderContainerRef = useRef<HTMLDivElement>(null)

  const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  async function load() {
    setLoading(true)
    const res = await fetch('/api/members')
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSelectAll() {
    const filtered = filteredMembers
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(m => m.id)))
  }

  const filteredMembers = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleGenerate() {
    setGenLoading(true)
    const range = hebrewYearToGregorianRange(selectedYear)
    const body: Record<string, unknown> = { date_from: range.start, date_to: range.end, hebrew_year: selectedYear }
    if (genMemberId) body.member_ids = [genMemberId]
    const res = await fetch('/api/invoices/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setGenResult(data)
    setGenLoading(false)
  }

  // Generate PDF from HTML rendered in hidden container
  const generatePdf = useCallback(async (memberIds: number[], forDownload: boolean, memberName?: string) => {
    setPdfGenerating(true)
    try {
      const range = hebrewYearToGregorianRange(selectedYear)
      const ids = memberIds.join(',')

      // Fetch the HTML from the API
      const res = await fetch(`/api/statements/pdf?member_ids=${ids}&date_from=${range.start}&date_to=${range.end}`)
      const html = await res.text()

      // Create a hidden iframe to render the HTML
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.left = '-9999px'
      iframe.style.top = '0'
      iframe.style.width = '800px'
      iframe.style.height = '1200px'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)

      // Write HTML to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error('Cannot access iframe document')
      iframeDoc.open()
      iframeDoc.write(html)
      iframeDoc.close()

      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 800))

      // Get all statement pages from iframe
      const pages = iframeDoc.querySelectorAll('.statement-page')

      let pdfBlob: Blob
      if (pages.length > 1) {
        const elements = Array.from(pages) as HTMLElement[]
        pdfBlob = await generateMultiMemberPdf(elements, '')
      } else if (pages.length === 1) {
        pdfBlob = await generatePdfFromElement(pages[0] as HTMLElement, '')
      } else {
        // Fallback: render the body
        pdfBlob = await generatePdfFromElement(iframeDoc.body, '')
      }

      // Clean up iframe
      document.body.removeChild(iframe)

      if (forDownload) {
        const today = new Date().toISOString().split('T')[0]
        const filename = memberIds.length === 1 && memberName
          ? `Statement_${memberName.replace(/\s+/g, '_')}_${today}.pdf`
          : `Statements_${today}.pdf`
        downloadBlob(pdfBlob, filename)
      } else {
        // Preview in modal
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        const url = createPdfPreviewUrl(pdfBlob)
        setPreviewUrl(url)
        setPreviewMemberIds(memberIds)
        setPreviewMemberName(memberName || '')
        setShowPreview(true)
      }
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert(he ? 'שגיאה ביצירת PDF' : 'PDF generation failed')
    } finally {
      setPdfGenerating(false)
    }
  }, [selectedYear, he, previewUrl])

  function viewStatement(memberId: number, memberName: string) {
    generatePdf([memberId], false, memberName)
  }

  function downloadStatement(memberId: number, memberName: string) {
    generatePdf([memberId], true, memberName)
  }

  function downloadBulkPDF() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    generatePdf(ids, true)
  }

  function downloadFromPreview() {
    if (!previewUrl || !previewMemberIds.length) return
    // Re-generate for download
    generatePdf(previewMemberIds, true, previewMemberName)
  }

  return (
    <div className="space-y-6">
      {/* Hidden container for PDF rendering */}
      <div ref={renderContainerRef} style={{ position: 'fixed', left: '-9999px', top: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText size={24} className="text-blue-600" /> {he ? 'דפי חשבון' : 'Statements'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setGenResult(null); setGenMemberId(''); setShowGenModal(true) }}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-purple-50 border border-purple-300 text-purple-800 hover:bg-purple-100 rounded-xl font-medium transition-colors"
          >
            <Zap size={15} />
            {he ? 'הפק דפי חשבון' : 'Generate Statements'}
          </button>
        </div>
      </div>

      {/* PDF generating indicator */}
      {pdfGenerating && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
          <Loader2 size={16} className="animate-spin" />
          {he ? 'מייצר PDF...' : 'Generating PDF...'}
        </div>
      )}

      {/* Year selector + Search */}
      <div className="flex gap-3 flex-wrap items-center">
        <div>
          <select
            className="input"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {hebrewYears.map(y => (
              <option key={y.year} value={y.year}>{y.label} ({y.year})</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input ps-9 w-full"
            placeholder={T.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-800">
            {selected.size} {he ? 'נבחרו' : 'selected'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={downloadBulkPDF}
              disabled={pdfGenerating}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium disabled:opacity-50"
            >
              <Download size={14} /> {he ? 'הורד הנבחרים' : 'Download Selected'}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg">
              {T.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{T.loading}</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{T.noData}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-2 py-3 w-10">
                  <input type="checkbox" checked={selected.size === filteredMembers.length && filteredMembers.length > 0} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="px-4 py-3 text-start">{T.name}</th>
                <th className="px-4 py-3 text-end hidden sm:table-cell">{he ? 'דמי חבר' : 'Fees'}</th>
                <th className="px-4 py-3 text-end hidden sm:table-cell">{he ? 'רכישות' : 'Purchases'}</th>
                <th className="px-4 py-3 text-end">{T.totalPayments}</th>
                <th className="px-4 py-3 text-end">{he ? 'יתרת חוב' : 'Balance'}</th>
                <th className="px-4 py-3 text-end w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMembers.map(m => (
                <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${selected.has(m.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-3">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/members/${m.id}`} className="text-blue-700 hover:text-blue-900 hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-end text-red-600 hidden sm:table-cell">{fmt(m.total_fees ?? 0)}</td>
                  <td className="px-4 py-3 text-end text-orange-600 hidden sm:table-cell">{fmt(m.total_purchases ?? 0)}</td>
                  <td className="px-4 py-3 text-end text-green-600">{fmt(m.total_payments ?? 0)}</td>
                  <td className="px-4 py-3 text-end font-semibold">
                    <span className={(m.balance ?? 0) < 0 ? 'text-red-600' : (m.balance ?? 0) > 0 ? 'text-green-600' : 'text-gray-500'}>
                      {(m.balance ?? 0) < 0 ? `-${fmt(m.balance ?? 0)}` : (m.balance ?? 0) > 0 ? `+${fmt(m.balance ?? 0)}` : '€0.00'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => viewStatement(m.id, m.name)}
                        disabled={pdfGenerating}
                        className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg disabled:opacity-50"
                        title={he ? 'תצוגה מקדימה' : 'Preview'}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => downloadStatement(m.id, m.name)}
                        disabled={pdfGenerating}
                        className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg disabled:opacity-50"
                        title={he ? 'הורד PDF' : 'Download PDF'}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PDF Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                {he ? 'תצוגה מקדימה' : 'PDF Preview'}
                {previewMemberName && <span className="text-gray-500 text-sm ms-2">— {previewMemberName}</span>}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadFromPreview}
                  disabled={pdfGenerating}
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-xl font-medium disabled:opacity-50"
                >
                  <Download size={15} />
                  {he ? 'הורד PDF' : 'Download PDF'}
                </button>
                <button
                  onClick={() => { setShowPreview(false); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl('') }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100 p-4">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg border border-gray-300 bg-white"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Generate Statements Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap size={20} className="text-purple-500" />
              {he ? 'הפקת דפי חשבון' : 'Generate Statements'}
            </h2>

            {genResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <CheckCircle size={20} />
                  {genResult.count} {he ? 'דפי חשבון הופקו' : 'statements generated'}
                </div>
                {genResult.invoices.length > 0 && (
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {genResult.invoices.map(inv => (
                      <div key={inv.id} className="px-4 py-2 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{inv.member}</span>
                          <span className="text-gray-500 ms-2">{fmt(inv.total)}</span>
                        </div>
                        <Link href={`/invoices/${inv.id}`} target="_blank" className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                          <Eye size={13} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                {genResult.count === 0 && (
                  <p className="text-gray-500 text-sm">{he ? 'לא נמצאו חיובים לתקופה זו.' : 'No charges found for this period.'}</p>
                )}
                <button onClick={() => setShowGenModal(false)} className="btn-secondary w-full">{T.cancel}</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  {he
                    ? 'בחר שנה עברית וחבר (אופציונלי). המערכת תיצור דף חשבון לכל חבר שיש לו חיובים ורכישות.'
                    : 'Select a Hebrew year and optionally a specific member.'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="label">{he ? 'שנה עברית' : 'Hebrew Year'}</label>
                    <select className="input w-full" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                      {hebrewYears.map(y => (
                        <option key={y.year} value={y.year}>{y.label} ({y.year})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{he ? 'חבר (אופציונלי)' : 'Member (optional)'}</label>
                    <select className="input w-full" value={genMemberId} onChange={e => setGenMemberId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">{he ? '— כל החברים —' : '— All Members —'}</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
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
                    {genLoading ? T.loading : (he ? 'הפק' : 'Generate')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
