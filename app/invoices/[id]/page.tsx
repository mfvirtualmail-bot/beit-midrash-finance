'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { Invoice } from '@/lib/db'
import { formatHebrewDate } from '@/lib/hebrewDate'
import { ArrowRight, Printer } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default function InvoiceDetailPage() {
  const { T, lang, isRTL } = useLang()
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/invoices/${params.id}`).then(r => r.json()).then(data => {
      setInvoice(data)
      setLoading(false)
    })
  }, [params.id])

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n)
  const statusLabel = (s: string) => ({ draft: T.draft, sent: T.sent, paid: T.paid, cancelled: T.cancelled }[s] ?? s)

  if (loading) return <div className="text-center py-16 text-gray-400">{T.loading}</div>
  if (!invoice) return <div className="text-center py-16 text-gray-400">{T.error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={() => router.push('/invoices')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{T.invoice} {invoice.number || `#${invoice.id}`}</h1>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer size={16} /> {T.printInvoice}
        </button>
      </div>

      {/* Printable invoice */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto print:shadow-none print:border-0 print:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-2xl font-bold text-blue-700 flex items-center gap-2">🕍 {T.appNameShort}</div>
            <div className="text-gray-500 text-sm mt-1">בית המדרש</div>
          </div>
          <div className="text-end">
            <div className="text-2xl font-bold text-gray-800">{T.invoice}</div>
            <div className="text-gray-500 font-mono">{invoice.number || `#${invoice.id}`}</div>
            <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status]}`}>
              {statusLabel(invoice.status)}
            </span>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <div className="text-gray-500">{T.invoiceDate}</div>
            <div className="font-medium">{invoice.date}</div>
            <div className="text-gray-400 text-xs mt-0.5" dir="rtl">{formatHebrewDate(invoice.date, 'he')}</div>
          </div>
          {invoice.due_date && (
            <div>
              <div className="text-gray-500">{T.dueDate}</div>
              <div className="font-medium">{invoice.due_date}</div>
              <div className="text-gray-400 text-xs mt-0.5" dir="rtl">{formatHebrewDate(invoice.due_date, 'he')}</div>
            </div>
          )}
        </div>

        {/* Recipient */}
        {(invoice.member_name || invoice.donor_name_he) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl text-sm">
            <div className="text-gray-500 mb-1">{T.recipient}</div>
            <div className="font-semibold text-gray-800">{invoice.member_name || invoice.donor_name_he}</div>
          </div>
        )}

        {/* Title */}
        <div className="mb-6">
          <div className="text-lg font-bold text-gray-900">{invoice.title_he}</div>
          {invoice.title_en && <div className="text-gray-600">{invoice.title_en}</div>}
        </div>

        {/* Items */}
        {invoice.items && invoice.items.length > 0 && (
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-start py-2 font-semibold text-gray-600">{T.description}</th>
                <th className="text-center py-2 font-semibold text-gray-600">{T.quantity}</th>
                <th className="text-end py-2 font-semibold text-gray-600">{T.unitPrice}</th>
                <th className="text-end py-2 font-semibold text-gray-600">{T.total}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">
                    <div>{item.description_he}</div>
                    {item.description_en && <div className="text-gray-400 text-xs">{item.description_en}</div>}
                  </td>
                  <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-2 text-end text-gray-600">{fmt(Number(item.unit_price))}</td>
                  <td className="py-2 text-end font-medium">{fmt(Number(item.amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={3} className="py-3 font-bold text-gray-800 text-end pe-4">{T.total}</td>
                <td className="py-3 font-bold text-blue-700 text-end text-lg">{fmt(invoice.total ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {invoice.notes && (
          <div className="text-sm text-gray-500 border-t border-gray-100 pt-4 mt-4">
            <span className="font-medium">{T.notes}:</span> {invoice.notes}
          </div>
        )}
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  )
}
