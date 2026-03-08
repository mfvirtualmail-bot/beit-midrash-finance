'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { TrendingUp, TrendingDown, Scale, ArrowLeftRight } from 'lucide-react'
import type { Transaction } from '@/lib/db'

interface Summary {
  total_income: number
  total_expense: number
  total_transactions: number
}

export default function DashboardPage() {
  const { T, lang } = useLang()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear().toString()
  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    Promise.all([
      fetch(`/api/reports?year=${currentYear}`).then(r => r.json()),
      fetch(`/api/transactions?limit=10`).then(r => r.json()),
    ]).then(([rep, txns]) => {
      setSummary(rep.summary)
      setRecent(txns)
      setLoading(false)
    })
  }, [currentYear])

  const balance = (summary?.total_income ?? 0) - (summary?.total_expense ?? 0)

  const fmt = (n: number) =>
    `${T.currency}${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return <div className="text-center py-20 text-gray-400">{T.loading}</div>

  const cards = [
    {
      label: `${T.income} (${currentYear})`,
      value: fmt(summary?.total_income ?? 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
    {
      label: `${T.expense} (${currentYear})`,
      value: fmt(summary?.total_expense ?? 0),
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
    {
      label: T.balance,
      value: fmt(balance),
      icon: Scale,
      color: balance >= 0 ? 'text-blue-600' : 'text-orange-600',
      bg: balance >= 0 ? 'bg-blue-50' : 'bg-orange-50',
      border: balance >= 0 ? 'border-blue-100' : 'border-orange-100',
      prefix: balance < 0 ? '-' : '',
    },
    {
      label: T.transactions,
      value: String(summary?.total_transactions ?? 0),
      icon: ArrowLeftRight,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{T.dashboard}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`card border ${border} ${bg}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={color} size={20} />
              </div>
            </div>
          </div>
        ))}
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
