'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Invoice } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { ArrowRight, Printer, Mail, Download } from 'lucide-react'

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

interface InvoiceWithEmail extends Invoice {
  member_email?: string | null
}

export default function InvoiceDetailPage() {
  const { T, lang, isRTL } = useLang()
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<InvoiceWithEmail | null>(null)
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${params.id}`).then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([invData, settingsData]) => {
      setInvoice(invData)
      setSettings(settingsData)
      setLoading(false)
    })
  }, [params.id])

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
  const statusLabel = (s: string) => ({ draft: T.draft, sent: T.sent, paid: T.paid, cancelled: T.cancelled }[s] ?? s)

  function handleEmail() {
    if (!invoice?.member_email) return
    const subject = encodeURIComponent(`${invoice.title_he} - ${invoice.number || '#' + invoice.id}`)
    const body = encodeURIComponent(
      `שלום,\n\nמצורפת חשבונית מספר ${invoice.number || invoice.id}.\nסכום: €${(invoice.total ?? 0).toLocaleString()}\n\nתודה,\n${settings?.org_name_he ?? 'בית המדרש'}`
    )
    window.open(`mailto:${invoice.member_email}?subject=${subject}&body=${body}`)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">{T.loading}</div>
  if (!invoice) return <div className="text-center py-16 text-gray-400">{T.error}</div>

  const orgNameHe = settings?.org_name_he || 'בית המדרש'
  const orgNameEn = settings?.org_name_en || 'Beit Midrash'
  const headerText = lang === 'he' ? settings?.invoice_header_he : settings?.invoice_header_en
  const footerText = lang === 'he' ? settings?.invoice_footer_he : settings?.invoice_footer_en
  const orgName = lang === 'he' ? orgNameHe : orgNameEn

  return (
    <div className="space-y-6">
      {/* Action bar — hidden on print */}
      <div className="flex items-center gap-3 print:hidden flex-wrap">
        <button onClick={() => router.push('/invoices')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{T.invoice} {invoice.number || `#${invoice.id}`}</h1>
        <div className="flex gap-2">
          {invoice.member_email ? (
            <button onClick={handleEmail} className="flex items-center gap-2 text-sm px-3 py-2 bg-green-50 border border-green-300 text-green-800 hover:bg-green-100 rounded-xl font-medium">
              <Mail size={15} /> {T.sendEmail}
            </button>
          ) : null}
          <button onClick={() => window.print()} className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-50 border border-blue-300 text-blue-800 hover:bg-blue-100 rounded-xl font-medium">
            <Download size={15} /> {T.downloadPDF}
          </button>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer size={16} /> {T.printInvoice}
          </button>
        </div>
      </div>

      {/* Printable invoice */}
      <div
        id="invoice-print"
        className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-2xl mx-auto print:shadow-none print:border-0 print:rounded-none print:max-w-full"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* === HEADER === */}
        <div className="border-b-4 border-blue-600 p-8 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-2xl font-bold text-blue-700 flex items-center gap-2">🕍 {orgName}</div>
              {settings?.org_address && (
                <div className="text-gray-500 text-sm mt-1">{settings.org_address}</div>
              )}
              {(settings?.org_phone || settings?.org_email) && (
                <div className="text-gray-500 text-sm mt-0.5">
                  {settings?.org_phone}{settings?.org_phone && settings?.org_email ? '  |  ' : ''}{settings?.org_email}
                </div>
              )}
              {headerText && (
                <div className="text-gray-600 text-sm mt-2 whitespace-pre-line border-t border-gray-200 pt-2">
                  {headerText}
                </div>
              )}
            </div>
            <div className="text-end">
              <div className="text-3xl font-bold text-gray-800">{T.invoice}</div>
              <div className="text-gray-500 font-mono text-sm mt-1">{invoice.number || `#${invoice.id}`}</div>
              <span className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[invoice.status]}`}>
                {statusLabel(invoice.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">{T.invoiceDate}</div>
              <div className="font-semibold text-gray-800">{invoice.date}</div>
              <div className="text-gray-400 text-xs mt-0.5" dir="rtl">{formatHebrewDate(invoice.date, 'he')}</div>
            </div>
            {invoice.due_date && (
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-amber-600 text-xs uppercase tracking-wide mb-1">{T.dueDate}</div>
                <div className="font-semibold text-gray-800">{invoice.due_date}</div>
                <div className="text-gray-400 text-xs mt-0.5" dir="rtl">{formatHebrewDate(invoice.due_date, 'he')}</div>
              </div>
            )}
          </div>

          {/* Recipient */}
          {(invoice.member_name || invoice.donor_name_he) && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-blue-600 text-xs uppercase tracking-wide mb-1">{T.recipient}</div>
              <div className="font-bold text-gray-800 text-lg">{invoice.member_name || invoice.donor_name_he}</div>
            </div>
          )}

          {/* Title */}
          <div className="border-b border-gray-100 pb-4">
            <div className="text-xl font-bold text-gray-900">{invoice.title_he}</div>
            {invoice.title_en && <div className="text-gray-500 mt-0.5">{invoice.title_en}</div>}
          </div>

          {/* Items */}
          {invoice.items && invoice.items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="text-start py-3 px-4 rounded-ss-lg font-semibold">{T.description}</th>
                  <th className="text-end py-3 px-4 rounded-se-lg font-semibold">{T.amount}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-3 px-4">
                      <div className="font-medium">{item.description_he}</div>
                      {item.description_en && item.description_en !== item.description_he && (
                        <div className="text-gray-400 text-xs">{item.description_en}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-end font-semibold">{fmt(Number(item.amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-600 text-white">
                  <td className="py-3 px-4 font-bold text-end rounded-bs-lg">{T.total}</td>
                  <td className="py-3 px-4 font-bold text-end text-xl rounded-be-lg">{fmt(invoice.total ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {invoice.notes && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <div className="font-semibold text-gray-700 mb-1">{T.notes}</div>
              <div className="whitespace-pre-line">{invoice.notes}</div>
            </div>
          )}
        </div>

        {/* === FOOTER === */}
        {(footerText || settings?.org_phone || settings?.org_email) && (
          <div className="border-t-2 border-gray-200 px-8 py-5 bg-gray-50 rounded-b-2xl print:rounded-none">
            {footerText && (
              <div className="text-sm text-gray-600 whitespace-pre-line">{footerText}</div>
            )}
            {!footerText && (settings?.org_phone || settings?.org_email) && (
              <div className="text-sm text-gray-500 text-center">
                {settings?.org_phone}{settings?.org_phone && settings?.org_email ? '  |  ' : ''}{settings?.org_email}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html { background: white !important; }
          /* Hide Next.js layout chrome */
          nav, header, aside, footer:not(#invoice-print footer) { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          /* Invoice container */
          #invoice-print {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            font-size: 12pt;
          }
          #invoice-print * { border-radius: 0 !important; }
          /* Preserve table header colors */
          #invoice-print table thead tr { background-color: #2563eb !important; color: white !important; }
          #invoice-print table tfoot tr { background-color: #2563eb !important; color: white !important; }
          #invoice-print table thead th, #invoice-print table tfoot td { color: white !important; }
          /* Page setup */
          @page { size: A4; margin: 15mm 20mm; }
          /* Avoid breaks inside items */
          #invoice-print table tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
