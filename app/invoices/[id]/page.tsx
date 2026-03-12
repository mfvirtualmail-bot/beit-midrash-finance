'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Invoice } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { generatePdfFromElement, downloadBlob, createPdfPreviewUrl } from '@/lib/pdfGenerator'
import { ArrowRight, Download, Eye, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

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

interface StatementLine {
  date: string
  period: string
  hebrewDate?: string
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

export default function InvoiceDetailPage() {
  const { T, lang, isRTL } = useLang()
  const he = lang === 'he'
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [statementData, setStatementData] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${params.id}`).then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(async ([invData, settingsData]) => {
      setInvoice(invData)
      setSettings(settingsData)

      if (invData.member_id) {
        const stRes = await fetch(`/api/statements?member_id=${invData.member_id}`)
        const stData = await stRes.json()
        setStatementData(stData)
      }

      setLoading(false)
    })
  }, [params.id])

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const fmt = (n: number) => `€${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const statusLabel = (s: string) => ({ draft: T.draft, sent: T.sent, paid: T.paid, cancelled: T.cancelled }[s] ?? s)

  const generatePdf = useCallback(async (forDownload: boolean) => {
    if (!statementData?.member) return
    setPdfGenerating(true)
    try {
      const res = await fetch(`/api/statements/pdf?member_ids=${statementData.member.id}`)
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

      const page = iframeDoc.querySelector('.statement-page') as HTMLElement || iframeDoc.body
      const pdfBlob = await generatePdfFromElement(page, '')

      document.body.removeChild(iframe)

      if (forDownload) {
        const today = new Date().toISOString().split('T')[0]
        const name = statementData.member.name.replace(/\s+/g, '_')
        downloadBlob(pdfBlob, `Statement_${name}_${today}.pdf`)
      } else {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        const url = createPdfPreviewUrl(pdfBlob)
        setPreviewUrl(url)
        setShowPreview(true)
      }
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert(he ? 'שגיאה ביצירת PDF' : 'PDF generation failed')
    } finally {
      setPdfGenerating(false)
    }
  }, [statementData, he, previewUrl])

  if (loading) return <div className="text-center py-16 text-gray-400">{T.loading}</div>
  if (!invoice) return <div className="text-center py-16 text-gray-400">{T.error}</div>

  const orgNameHe = settings?.org_name_he || 'בית המדרש'
  const orgNameEn = settings?.org_name_en || 'Beit Midrash'
  const headerText = he ? settings?.invoice_header_he : settings?.invoice_header_en
  const footerText = he ? settings?.invoice_footer_he : settings?.invoice_footer_en
  const orgName = he ? orgNameHe : orgNameEn
  const hasStatement = !!statementData && statementData.lines.length > 0

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/invoices')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          {he ? 'דף חשבון' : 'Statement'} {invoice.number || `#${invoice.id}`}
        </h1>
        <div className="flex gap-2">
          {statementData?.member && (
            <>
              <button
                onClick={() => generatePdf(false)}
                disabled={pdfGenerating}
                className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-50 border border-blue-300 text-blue-800 hover:bg-blue-100 rounded-xl font-medium disabled:opacity-50"
              >
                {pdfGenerating ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                {he ? 'תצוגה מקדימה' : 'Preview PDF'}
              </button>
              <button
                onClick={() => generatePdf(true)}
                disabled={pdfGenerating}
                className="flex items-center gap-2 text-sm px-3 py-2 bg-green-50 border border-green-300 text-green-800 hover:bg-green-100 rounded-xl font-medium disabled:opacity-50"
              >
                {pdfGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {T.downloadPDF}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statement content */}
      <div
        id="invoice-print"
        className="max-w-3xl mx-auto overflow-hidden rounded-2xl shadow-sm border border-gray-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header block */}
        <div className="bg-gradient-to-bl from-blue-700 via-blue-600 to-blue-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img src="/api/logo" alt="Logo" className="w-14 h-14 object-contain rounded-lg bg-white/15 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <div className="text-lg font-bold tracking-wide">{orgName}</div>
              {settings?.org_address && <div className="text-[10px] text-white/80 mt-0.5">{settings.org_address}</div>}
              {(settings?.org_phone || settings?.org_email) && (
                <div className="text-[10px] text-white/75 mt-0.5">
                  {[settings?.org_phone, settings?.org_email].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </div>
          <div className="text-end">
            <div className="text-2xl font-extrabold tracking-wider">{he ? 'דף חשבון' : 'Statement'}</div>
            <div className="text-xs text-white/70 mt-1 font-mono">{invoice.number || `#${invoice.id}`}</div>
            <div className="text-xs text-white/70 mt-0.5">{invoice.date}</div>
          </div>
        </div>

        {headerText && (
          <div className="bg-blue-50 border-e-4 border-blue-600 px-4 py-2.5 text-[11px] text-blue-800 [&_p]:my-0.5 [&_img]:max-w-full [&_img]:h-auto" dangerouslySetInnerHTML={{ __html: headerText }} />
        )}

        {/* Recipient block */}
        <div className="mx-5 mt-4 mb-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 font-medium mb-0.5">{T.recipient}</div>
          <div className="text-base font-bold text-slate-900">
            {invoice.member_id ? (
              <Link href={`/members/${invoice.member_id}`} className="text-blue-700 hover:text-blue-900 hover:underline">
                {invoice.member_name || invoice.donor_name_he}
              </Link>
            ) : (
              <span>{invoice.member_name || invoice.donor_name_he}</span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-0.5" dir="rtl">{formatHebrewDate(invoice.date, 'he')}</div>
        </div>

        {/* Table block */}
        {hasStatement ? (
          <>
            <div className="mx-5 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-start py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200" style={{ width: '22%' }}>{he ? 'תקופה / שבוע' : 'Period / Week'}</th>
                    <th className="text-start py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200" style={{ width: '38%' }}>{he ? 'פריט / תיאור' : 'Item / Description'}</th>
                    <th className="text-end py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200" style={{ width: '20%' }}>{he ? 'חיוב (€)' : 'Charge (€)'}</th>
                    <th className="text-end py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200" style={{ width: '20%' }}>{he ? 'תשלום (€)' : 'Payment (€)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData!.lines.map((line, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2 px-3.5 text-slate-500 font-medium text-[11px]" dir="rtl">{line.period || line.hebrewDate || line.date}</td>
                      <td className="py-2 px-3.5 font-semibold text-slate-800 text-[12px]">{line.description}</td>
                      <td className="py-2 px-3.5 text-end text-red-600 font-semibold text-[12px]">{line.charge > 0 ? fmt(line.charge) : ''}</td>
                      <td className="py-2 px-3.5 text-end text-green-600 font-semibold text-[12px]">{line.payment > 0 ? fmt(line.payment) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals block */}
            <div className="mx-5 mt-3 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-500">{he ? 'סה"כ חיובים' : 'Total Charges'}</span>
                <span className="text-sm font-bold text-red-600">{fmt(statementData!.totalCharged)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-500">{he ? 'סה"כ תשלומים' : 'Total Payments'}</span>
                <span className="text-sm font-bold text-green-600">{fmt(statementData!.totalPaid)}</span>
              </div>
            </div>

            {/* Balance block */}
            <div className={`mx-5 mt-3 rounded-xl p-4 flex items-center justify-between ${statementData!.remainingBalance <= 0 ? 'bg-gradient-to-bl from-green-700 to-green-600' : 'bg-gradient-to-bl from-blue-800 via-blue-600 to-blue-700'} text-white`}>
              <span className="text-base font-bold">{he ? 'יתרת חוב' : 'Remaining Balance'}</span>
              <span className="text-xl font-extrabold tracking-wide">
                {statementData!.remainingBalance > 0
                  ? fmt(statementData!.remainingBalance)
                  : statementData!.remainingBalance < 0
                    ? `${he ? 'זיכוי' : 'Credit'} ${fmt(Math.abs(statementData!.remainingBalance))}`
                    : '€0.00'
                }
              </span>
            </div>
          </>
        ) : invoice.items && invoice.items.length > 0 ? (
          <>
            <div className="mx-5 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-start py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200">{he ? 'תקופה / שבוע' : 'Date / Period'}</th>
                    <th className="text-start py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200">{he ? 'פריט' : 'Item'}</th>
                    <th className="text-end py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200">{he ? 'חיוב (€)' : 'Charge (€)'}</th>
                    <th className="text-end py-2.5 px-3.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider border-b-2 border-slate-200">{he ? 'תשלום (€)' : 'Payment (€)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => {
                    let period = (item as { period?: string }).period || ''
                    let itemName = item.description_he || ''
                    if (!period && itemName.includes(' - ')) {
                      const parts = itemName.split(' - ')
                      period = parts[0]
                      itemName = parts.slice(1).join(' - ')
                    }
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="py-2 px-3.5 text-slate-500 font-medium text-[11px]">{period || '—'}</td>
                        <td className="py-2 px-3.5 font-semibold text-slate-800 text-[12px]">{itemName}</td>
                        <td className="py-2 px-3.5 text-end text-red-600 font-semibold text-[12px]">{fmt(Number(item.amount))}</td>
                        <td className="py-2 px-3.5 text-end text-green-600"></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mx-5 mt-3 bg-gradient-to-bl from-blue-800 via-blue-600 to-blue-700 text-white rounded-xl p-4 flex items-center justify-between">
              <span className="text-base font-bold">{T.total}</span>
              <span className="text-xl font-extrabold">{fmt(invoice.total ?? 0)}</span>
            </div>
          </>
        ) : null}

        {invoice.notes && (
          <div className="mx-5 mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-slate-500 mb-1">{T.notes}</div>
            <div className="text-xs text-slate-600 whitespace-pre-line">{invoice.notes}</div>
          </div>
        )}

        {/* Footer block */}
        {(footerText || settings?.org_phone || settings?.org_email) ? (
          <div className="mx-5 mt-4 mb-5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
            {footerText && <div className="text-[10px] text-slate-500 [&_p]:my-0.5 [&_img]:max-w-full [&_img]:h-auto" dangerouslySetInnerHTML={{ __html: footerText }} />}
            {!footerText && (settings?.org_phone || settings?.org_email) && (
              <div className="text-[10px] text-slate-400">
                {[settings?.org_phone, settings?.org_email].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ) : <div className="h-5" />}
      </div>

      {/* PDF Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Eye size={20} className="text-blue-600" />
                {he ? 'תצוגה מקדימה' : 'PDF Preview'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generatePdf(true)}
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
