'use client'
import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Member } from '@/lib/db'
import { getCurrentHebrewYear, getRecentHebrewYears, hebrewYearToGregorianRange } from '@/lib/hebrewDate'
import { generatePdfFromElement, generateMultiMemberPdf, downloadBlob, createPdfPreviewUrl } from '@/lib/pdfGenerator'
import { FileText, Eye, Download, Search, X, Loader2, Send, Mail } from 'lucide-react'
import Link from 'next/link'

// Wrapper to satisfy Next.js Suspense requirement for useSearchParams
export default function StatementsPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <StatementsPage />
    </Suspense>
  )
}

interface StatementLine {
  date: string
  period: string
  description: string
  charge: number
  payment: number
  lineType?: 'membership' | 'purchase' | 'payment'
}

interface StatementData {
  member: { id: number; name: string; phone: string | null; email: string | null; address: string | null }
  lines: StatementLine[]
  totalCharged: number
  totalPaid: number
  remainingBalance: number
}

function StatementsPage() {
  const { T, lang } = useLang()
  const he = lang === 'he'
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<(Member & { total_fees: number; total_purchases: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Year selector
  const hebrewYears = getRecentHebrewYears()
  const [selectedYear, setSelectedYear] = useState(getCurrentHebrewYear())

  // View statement modal (dynamic, real-time view)
  const [viewMember, setViewMember] = useState<{ id: number; name: string } | null>(null)
  const [viewYear, setViewYear] = useState(getCurrentHebrewYear())
  const [statementData, setStatementData] = useState<StatementData | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)

  // PDF preview modal
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [previewMemberIds, setPreviewMemberIds] = useState<number[]>([])
  const [previewMemberName, setPreviewMemberName] = useState('')
  const renderContainerRef = useRef<HTMLDivElement>(null)

  // Email state
  const [sendingEmail, setSendingEmail] = useState<number | null>(null) // member_id being emailed
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: number; name: string; is_default: boolean }>>([])
  const [pendingEmailMember, setPendingEmailMember] = useState<number | null>(null)

  const fmt = (n: number) => `€${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  async function load() {
    setLoading(true)
    const res = await fetch('/api/members')
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Load email templates
  useEffect(() => {
    fetch('/api/email-templates').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setEmailTemplates(data)
    }).catch(() => {})
  }, [])

  // Auto-open statement view if navigated with ?view=memberId
  useEffect(() => {
    const viewId = searchParams.get('view')
    if (viewId && members.length > 0 && !viewMember) {
      const member = members.find(m => m.id === Number(viewId))
      if (member) {
        openViewStatement(member.id, member.name)
      }
    }
  }, [searchParams, members]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load dynamic statement data for a member + year
  const loadStatement = useCallback(async (memberId: number, year: number) => {
    setStatementLoading(true)
    try {
      const range = hebrewYearToGregorianRange(year)
      const res = await fetch(`/api/statements?member_id=${memberId}&date_from=${range.start}&date_to=${range.end}`)
      const data = await res.json()
      setStatementData(data)
    } catch (err) {
      console.error('Failed to load statement:', err)
      setStatementData(null)
    } finally {
      setStatementLoading(false)
    }
  }, [])

  // Open "View Statement" modal
  function openViewStatement(memberId: number, memberName: string) {
    const year = selectedYear
    setViewMember({ id: memberId, name: memberName })
    setViewYear(year)
    setStatementData(null)
    loadStatement(memberId, year)
  }

  // When year changes in view modal, reload data
  function handleViewYearChange(year: number) {
    setViewYear(year)
    if (viewMember) {
      loadStatement(viewMember.id, year)
    }
  }

  // Generate PDF from HTML rendered in hidden container
  const generatePdf = useCallback(async (memberIds: number[], forDownload: boolean, memberName?: string, yearOverride?: number) => {
    setPdfGenerating(true)
    try {
      const year = yearOverride ?? selectedYear
      const range = hebrewYearToGregorianRange(year)
      const ids = memberIds.join(',')

      const res = await fetch(`/api/statements/pdf?member_ids=${ids}&date_from=${range.start}&date_to=${range.end}`)
      const html = await res.text()

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.left = '-9999px'
      iframe.style.top = '0'
      iframe.style.width = '800px'
      iframe.style.height = '1200px'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error('Cannot access iframe document')
      iframeDoc.open()
      iframeDoc.write(html)
      iframeDoc.close()

      await new Promise(resolve => setTimeout(resolve, 800))

      const pages = iframeDoc.querySelectorAll('.statement-page')

      let pdfBlob: Blob
      if (pages.length > 1) {
        const elements = Array.from(pages) as HTMLElement[]
        pdfBlob = await generateMultiMemberPdf(elements, '')
      } else if (pages.length === 1) {
        pdfBlob = await generatePdfFromElement(pages[0] as HTMLElement, '')
      } else {
        pdfBlob = await generatePdfFromElement(iframeDoc.body, '')
      }

      document.body.removeChild(iframe)

      if (forDownload) {
        const today = new Date().toISOString().split('T')[0]
        const filename = memberIds.length === 1 && memberName
          ? `Statement_${memberName.replace(/\s+/g, '_')}_${today}.pdf`
          : `Statements_${today}.pdf`
        downloadBlob(pdfBlob, filename)
      } else {
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
    generatePdf(previewMemberIds, true, previewMemberName)
  }

  function sendStatementEmail(memberId: number) {
    if (emailTemplates.length > 1) {
      setPendingEmailMember(memberId)
      return
    }
    const defaultTpl = emailTemplates.find(t => t.is_default) || emailTemplates[0]
    sendStatementEmailWithTemplate(memberId, defaultTpl?.id ?? null)
  }

  async function sendStatementEmailWithTemplate(memberId: number, templateId: number | null) {
    setPendingEmailMember(null)
    setSendingEmail(memberId)
    setEmailMsg(null)
    try {
      const range = hebrewYearToGregorianRange(viewYear || selectedYear)
      const fd = new FormData()
      fd.append('member_id', String(memberId))
      fd.append('date_from', range.start)
      fd.append('date_to', range.end)
      if (templateId) fd.append('template_id', String(templateId))
      const res = await fetch('/api/email/send-statement', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setEmailMsg({ type: 'ok', text: he ? 'האימייל נשלח בהצלחה' : 'Email sent successfully' })
      } else {
        setEmailMsg({ type: 'err', text: data.error || (he ? 'שגיאה בשליחה' : 'Failed to send') })
      }
    } catch {
      setEmailMsg({ type: 'err', text: he ? 'שגיאת רשת' : 'Network error' })
    }
    setSendingEmail(null)
    setTimeout(() => setEmailMsg(null), 5000)
  }

  return (
    <div className="space-y-6">
      {/* Hidden container for PDF rendering */}
      <div ref={renderContainerRef} style={{ position: 'fixed', left: '-9999px', top: 0 }} />

      {/* Template picker modal */}
      {pendingEmailMember !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPendingEmailMember(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Mail size={18} className="text-purple-600" />
                {he ? 'בחר תבנית אימייל' : 'Choose email template'}
              </h2>
              <button onClick={() => setPendingEmailMember(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-2">
              {emailTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => sendStatementEmailWithTemplate(pendingEmailMember, t.id)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-xl text-sm text-gray-800 font-medium text-right transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Send size={14} className="text-purple-500" />
                    {t.name}
                  </span>
                  {t.is_default && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                      {he ? 'ברירת מחדל' : 'default'}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <Link
              href="/settings/email-templates"
              className="block text-xs text-center text-purple-600 hover:text-purple-800 underline"
            >
              {he ? 'נהל תבניות' : 'Manage templates'}
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText size={24} className="text-blue-600" /> {he ? 'דפי חשבון' : 'Statements'}
        </h1>
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

      {/* Email message */}
      {emailMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${emailMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {emailMsg.type === 'ok' ? <Mail size={16} /> : <X size={16} />}
          {emailMsg.text}
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
                <th className="px-4 py-3 text-end w-28"></th>
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
                        onClick={() => openViewStatement(m.id, m.name)}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium"
                        title={he ? 'צפה בדף חשבון' : 'View Statement'}
                      >
                        <Eye size={14} />
                        {he ? 'צפה' : 'View'}
                      </button>
                      <button
                        onClick={() => downloadStatement(m.id, m.name)}
                        disabled={pdfGenerating}
                        className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg disabled:opacity-50"
                        title={he ? 'הורד PDF' : 'Download PDF'}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => sendStatementEmail(m.id)}
                        disabled={sendingEmail === m.id || !m.email}
                        className="p-1.5 hover:bg-purple-100 text-purple-600 rounded-lg disabled:opacity-50"
                        title={!m.email ? (he ? 'אין כתובת אימייל' : 'No email') : (he ? 'שלח באימייל' : 'Send Email')}
                      >
                        {sendingEmail === m.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Statement Modal (Dynamic real-time view) */}
      {viewMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                {he ? 'דף חשבון' : 'Statement'} — {viewMember.name}
              </h2>
              <div className="flex items-center gap-2">
                {/* Year dropdown that refreshes data */}
                <select
                  className="input text-sm"
                  value={viewYear}
                  onChange={e => handleViewYearChange(Number(e.target.value))}
                >
                  {hebrewYears.map(y => (
                    <option key={y.year} value={y.year}>{y.label} ({y.year})</option>
                  ))}
                </select>
                <button
                  onClick={() => generatePdf([viewMember.id], true, viewMember.name, viewYear)}
                  disabled={pdfGenerating || statementLoading}
                  className="flex items-center gap-1 text-sm px-3 py-2 bg-green-50 border border-green-300 text-green-800 hover:bg-green-100 rounded-xl font-medium disabled:opacity-50"
                >
                  {pdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {he ? 'הורד PDF' : 'Download'}
                </button>
                <button
                  onClick={() => sendStatementEmail(viewMember.id)}
                  disabled={sendingEmail === viewMember.id}
                  className="flex items-center gap-1 text-sm px-3 py-2 bg-purple-50 border border-purple-300 text-purple-800 hover:bg-purple-100 rounded-xl font-medium disabled:opacity-50"
                >
                  {sendingEmail === viewMember.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {he ? 'שלח באימייל' : 'Email'}
                </button>
                <button
                  onClick={() => { setViewMember(null); setStatementData(null) }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal body - statement content */}
            <div className="flex-1 overflow-y-auto p-5" dir="rtl">
              {statementLoading ? (
                <div className="py-16 text-center text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" />
                  {T.loading}
                </div>
              ) : !statementData || statementData.lines.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  {he ? 'אין נתונים לתקופה זו' : 'No data for this period'}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                      <p className="text-xs text-red-500">{he ? 'סה"כ חיובים' : 'Total Charges'}</p>
                      <p className="text-lg font-bold text-red-600">{fmt(statementData.totalCharged)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <p className="text-xs text-green-500">{he ? 'סה"כ תשלומים' : 'Total Payments'}</p>
                      <p className="text-lg font-bold text-green-600">{fmt(statementData.totalPaid)}</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center border ${statementData.remainingBalance > 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                      <p className="text-xs text-gray-500">{he ? 'יתרת חוב' : 'Balance'}</p>
                      <p className={`text-lg font-bold ${statementData.remainingBalance > 0 ? 'text-blue-700' : statementData.remainingBalance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {statementData.remainingBalance > 0 ? fmt(statementData.remainingBalance)
                          : statementData.remainingBalance < 0 ? `${he ? 'זיכוי' : 'Credit'} ${fmt(Math.abs(statementData.remainingBalance))}`
                          : '€0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-start py-2.5 px-3.5 font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b-2 border-gray-200" style={{ width: '22%' }}>{he ? 'תקופה / שבוע' : 'Period / Week'}</th>
                          <th className="text-start py-2.5 px-3.5 font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b-2 border-gray-200" style={{ width: '38%' }}>{he ? 'פריט / תיאור' : 'Item / Description'}</th>
                          <th className="text-end py-2.5 px-3.5 font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b-2 border-gray-200" style={{ width: '20%' }}>{he ? 'חיוב (€)' : 'Charge (€)'}</th>
                          <th className="text-end py-2.5 px-3.5 font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b-2 border-gray-200" style={{ width: '20%' }}>{he ? 'תשלום (€)' : 'Payment (€)'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementData.lines.map((line, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="py-2 px-3.5 text-gray-500 font-medium text-[11px]">{line.period}</td>
                            <td className="py-2 px-3.5 font-semibold text-gray-800 text-[12px]">{line.description}</td>
                            <td className="py-2 px-3.5 text-end text-red-600 font-semibold text-[12px]">{line.charge > 0 ? fmt(line.charge) : ''}</td>
                            <td className="py-2 px-3.5 text-end text-green-600 font-semibold text-[12px]">{line.payment > 0 ? fmt(line.payment) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
