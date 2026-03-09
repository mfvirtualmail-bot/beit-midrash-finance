'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip
} from 'recharts'

interface MonthlyRow { month: string; income: number; expense: number }
interface CategoryRow { name_he: string; name_en: string; color: string; type: string; total: number }
interface Summary { total_income: number; total_expense: number; total_transactions: number }

const MONTH_NAMES_HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']
const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportsPage() {
  const { T, lang } = useLang()
  const [data, setData] = useState<{ monthly: MonthlyRow[]; byCategory: CategoryRow[]; summary: Summary; years: { year: string }[]; year: string } | null>(null)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?year=${year}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [year])

  const fmt = (n: number) => `${T.currency}${n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(true)
    const url = `/api/export?format=${format}&year=${year}`
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `finance-${year}.${format}`
    a.click()
    setExporting(false)
  }

  // Fill all 12 months
  const monthlyFull = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const key = `${year}-${m}`
    const found = data?.monthly.find(r => r.month === key)
    return {
      name: lang === 'he' ? MONTH_NAMES_HE[i] : MONTH_NAMES_EN[i],
      income: found?.income ?? 0,
      expense: found?.expense ?? 0,
    }
  })

  const incomeByCategory = data?.byCategory.filter(c => c.type === 'income') ?? []
  const expenseByCategory = data?.byCategory.filter(c => c.type === 'expense') ?? []

  if (loading) return <div className="text-center py-20 text-gray-400">{T.loading}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{T.reports}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input w-32" value={year} onChange={e => setYear(e.target.value)}>
            {(data?.years ?? [{ year }]).map(({ year: y }) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={() => handleExport('xlsx')} disabled={exporting}
            className="btn-primary flex items-center gap-2 text-sm">
            <Download size={14} /> {T.export}
          </button>
          <button onClick={() => handleExport('csv')} disabled={exporting}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> {T.exportCSV}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center border border-green-100 bg-green-50">
          <p className="text-xs text-gray-500 mb-1">{T.income}</p>
          <p className="text-xl font-bold text-green-600">{fmt(data?.summary?.total_income ?? 0)}</p>
        </div>
        <div className="card text-center border border-red-100 bg-red-50">
          <p className="text-xs text-gray-500 mb-1">{T.expense}</p>
          <p className="text-xl font-bold text-red-600">{fmt(data?.summary?.total_expense ?? 0)}</p>
        </div>
        <div className="card text-center border border-blue-100 bg-blue-50">
          <p className="text-xs text-gray-500 mb-1">{T.balance}</p>
          <p className={`text-xl font-bold ${(data?.summary?.total_income ?? 0) >= (data?.summary?.total_expense ?? 0) ? 'text-blue-600' : 'text-orange-600'}`}>
            {fmt((data?.summary?.total_income ?? 0) - (data?.summary?.total_expense ?? 0))}
          </p>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-700 mb-4">{T.monthlyReport} - {year}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyFull} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `€${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
            <Legend />
            <Bar dataKey="income" name={T.income} fill="#22c55e" radius={[4,4,0,0]} />
            <Bar dataKey="expense" name={T.expense} fill="#ef4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { label: T.income, items: incomeByCategory },
          { label: T.expense, items: expenseByCategory },
        ].map(({ label, items }) => (
          <div key={label} className="card">
            <h2 className="text-base font-semibold text-gray-700 mb-4">{label} - {T.byCategory}</h2>
            {items.length === 0 ? (
              <p className="text-gray-400 text-center py-8">{T.noData}</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={items} dataKey="total" nameKey={lang === 'he' ? 'name_he' : 'name_en'}
                      cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                      } labelLine={false}>
                      {items.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <PieTooltip formatter={(v: unknown) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1">
                  {items.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-gray-600">{lang === 'he' ? c.name_he : c.name_en}</span>
                      </div>
                      <span className="font-medium text-gray-800">{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
