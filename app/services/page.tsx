'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { Download, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

interface Service {
  id: string
  name_he: string
  name_en: string
  offsetMinutes: number
}

interface DayTiming {
  date: string
  hebrewDate: string
  sunset: string
  services: Record<string, string>
}

export default function ServicesPage() {
  const { lang, T, isRTL } = useLang()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [services, setServices] = useState<Service[]>([])
  const [timings, setTimings] = useState<DayTiming[]>([])
  const [visibleServices, setVisibleServices] = useState<Set<string>>(new Set())
  const [filteredTimings, setFilteredTimings] = useState<DayTiming[]>([])

  // Load timings
  async function loadTimings(selectedYear: string) {
    try {
      setLoading(true)
      const res = await fetch(`/api/services/timings?year=${selectedYear}`)
      if (!res.ok) throw new Error('Failed to load timings')

      const data = await res.json()
      setServices(data.services)
      setTimings(data.timings)

      // By default, show all services
      const allServiceIds = new Set(data.services.map((s: Service) => s.id))
      setVisibleServices(allServiceIds)
      setFilteredTimings(data.timings)
    } catch (e) {
      setError(lang === 'he' ? 'שגיאה בטעינת הזמנים' : 'Failed to load timings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTimings(year)
  }, [])

  // Handle year change
  function handleYearChange(newYear: string) {
    setYear(newYear)
    loadTimings(newYear)
  }

  // Toggle service visibility
  function toggleService(serviceId: string) {
    const newVisible = new Set(visibleServices)
    if (newVisible.has(serviceId)) {
      newVisible.delete(serviceId)
    } else {
      newVisible.add(serviceId)
    }
    setVisibleServices(newVisible)
  }

  // Export to Excel
  function exportToExcel() {
    const data = filteredTimings.map((timing) => ({
      [lang === 'he' ? 'תאריך' : 'Date']: timing.date,
      [lang === 'he' ? 'תאריך עברי' : 'Hebrew Date']: timing.hebrewDate,
      [lang === 'he' ? 'שקיעה' : 'Sunset']: timing.sunset,
      ...Array.from(visibleServices).reduce(
        (acc, serviceId) => {
          const service = services.find((s) => s.id === serviceId)
          if (service) {
            acc[lang === 'he' ? service.name_he : service.name_en] = timing.services[serviceId]
          }
          return acc
        },
        {} as Record<string, string>
      ),
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Timings')
    XLSX.writeFile(wb, `prayer-timings-${year}.xlsx`)
  }

  const getServiceName = (service: Service): string => (lang === 'he' ? service.name_he : service.name_en)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              {lang === 'he' ? 'זמנים לתפילות' : 'Prayer Service Timings'}
            </h1>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Year Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {lang === 'he' ? 'שנה' : 'Year'}
              </label>
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Visibility Toggles */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {lang === 'he' ? 'תפילות להצגה' : 'Services to Display'}
              </label>
              <div className="flex flex-wrap gap-3">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      visibleServices.has(service.id)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-300'
                    }`}
                  >
                    {visibleServices.has(service.id) ? (
                      <Eye size={16} />
                    ) : (
                      <EyeOff size={16} />
                    )}
                    {getServiceName(service)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              <Download size={18} />
              {lang === 'he' ? 'ייצוא Excel' : 'Export Excel'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">{lang === 'he' ? 'טוען...' : 'Loading...'}</p>
          </div>
        )}

        {/* Table */}
        {!loading && timings.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">
                      {lang === 'he' ? 'תאריך' : 'Date'}
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">
                      {lang === 'he' ? 'תאריך עברי' : 'Hebrew Date'}
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">
                      {lang === 'he' ? 'שקיעה' : 'Sunset'}
                    </th>
                    {Array.from(visibleServices).map((serviceId) => {
                      const service = services.find((s) => s.id === serviceId)
                      return (
                        <th key={serviceId} className="px-6 py-3 text-left font-semibold text-gray-700">
                          {service && getServiceName(service)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTimings.slice(0, 100).map((timing, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900">{timing.date}</td>
                      <td className="px-6 py-3 text-gray-700">{timing.hebrewDate}</td>
                      <td className="px-6 py-3 font-medium text-gray-900">{timing.sunset}</td>
                      {Array.from(visibleServices).map((serviceId) => (
                        <td key={serviceId} className="px-6 py-3 font-medium text-gray-900">
                          {timing.services[serviceId]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 border-t">
              {lang === 'he'
                ? `מוצגים ${filteredTimings.length > 100 ? 'ראשון 100' : filteredTimings.length} ימים`
                : `Showing ${filteredTimings.length > 100 ? 'first 100' : filteredTimings.length} days`}
            </div>
          </div>
        )}

        {!loading && timings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">{lang === 'he' ? 'אין נתונים' : 'No data'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
