'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { TrendingUp, TrendingDown, Scale, ArrowLeftRight, Users, AlertCircle } from 'lucide-react'
import type { Transaction } from '@/lib/db'

interface Summary {
  total_charged: number
  total_collected: number
  total_outstanding: number
  total_other_income: number
  total_actual_income: number
  total_expenses: number
  net_balance: number
  net_with_pledges: number
  total_transactions: number
}

export default function DashboardPage() {
  const { T, lang } = useLang()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear().toString()

  useEffect(() => {
    Promise.all([
      fetch(`/api/reports?year=${currentYear}`).then(r => r.json()),
      fetch(`/api/transactions?limit=10`).then(r => r.json()),
    ]).then(([rep, txns]) => {
      setSummary(rep.summary)
      setRecent(Array.isArray(txns) ? txns : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [currentYear])

  const fmt = (n: number) =>
    `${T.currency}${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return <div className="text-center py-20 text-gray-400">{T.loading}</div>

  const s = summary ?? {
    total_charged: 0, total_collected: 0, total_outstanding: 0,
    total_other_income: 0, total_actual_income: 0, total_expenses: 0,
    net_balance: 0, net_with_pledges: 0, total_transactions: 0,
  }

  const netBalance = s.net_balance

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src="/api/logo" alt="Logo" className="w-12 h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <h1 className="text-2xl font-bold text-gray-900">{T.dashboard} — {currentYear}</h1>
      </div>

      {/* Row 1: Member charges picture */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          {lang === 'he' ? 'חיובים וגבייה מחברים' : 'Member Charges & Collections'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Charged (pledges) */}
          <div className="card border border-blue-100 bg-blue-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{T.totalCharged}</p>
                <p className="text-xl font-bold text-blue-700">{fmt(s.total_charged)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'he' ? 'דמי חבר + עליות (חיובים)' : 'Membership fees + aliyot (pledges)'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="text-blue-600" size={20} />
              </div>
            </div>
          </div>

          {/* Collected (actual cash from members) */}
          <div className="card border border-green-100 bg-green-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{T.totalCollected}</p>
                <p className="text-xl font-bold text-green-700">{fmt(s.total_collected)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'he' ? 'תשלומים שהתקבלו בפועל' : 'Payments actually received'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="text-green-600" size={20} />
              </div>
            </div>
          </div>

          {/* Outstanding (still owed) */}
          <div className="card border border-orange-100 bg-orange-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{T.totalOutstanding}</p>
                <p className="text-xl font-bold text-orange-700">{fmt(s.total_outstanding)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'he' ? 'טרם שולם על ידי חברים' : 'Not yet paid by members'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-orange-100">
                <AlertCircle className="text-orange-600" size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Institution cash flow */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          {lang === 'he' ? 'תזרים מזומנים של המוסד' : 'Institution Cash Flow'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Other income (donations + income transactions) */}
          <div className="card border border-teal-100 bg-teal-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{T.otherIncome}</p>
                <p className="text-xl font-bold text-teal-700">{fmt(s.total_other_income)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'he' ? 'תרומות + הכנסות אחרות' : 'Donations + other income'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-teal-100">
                <ArrowLeftRight className="text-teal-600" size={20} />
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="card border border-red-100 bg-red-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{T.expense}</p>
                <p className="text-xl font-bold text-red-700">{fmt(s.total_expenses)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'he' ? 'חשמל, ניקיון, אחזקה...' : 'Electricity, cleaning, maintenance...'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="text-red-600" size={20} />
              </div>
            </div>
          </div>

          {/* Net balance (actual) */}
          <div className={`card border ${netBalance >= 0 ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{T.netBalance}</p>
                <p className={`text-xl font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {netBalance < 0 ? '-' : ''}{fmt(netBalance)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'he'
                    ? `הכנסה בפועל (${fmt(s.total_actual_income)}) פחות הוצאות`
                    : `Actual income (${fmt(s.total_actual_income)}) minus expenses`}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                <Scale className={netBalance >= 0 ? 'text-blue-600' : 'text-red-600'} size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{T.recentTransactions}</h2>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-center py-8">{T.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 font-semibold text-gray-500 text-start">{T.date}</th>
                  <th className="pb-3 font-semibold text-gray-500 text-start">{T.description}</th>
                  <th className="pb-3 font-semibold text-gray-500 text-start">{T.category}</th>
                  <th className="pb-3 font-semibold text-gray-500 text-end">{T.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-500">{tx.date}</td>
                    <td className="py-3 text-gray-700">
                      {lang === 'he' ? (tx.description_he || tx.description_en || '—') : (tx.description_en || tx.description_he || '—')}
                    </td>
                    <td className="py-3">
                      {tx.category_name_he ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: tx.category_color || '#6b7280' }}
                        >
                          {lang === 'he' ? tx.category_name_he : tx.category_name_en}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className={`py-3 font-semibold text-end ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
