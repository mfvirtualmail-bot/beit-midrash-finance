'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'
import { Users, Search, ExternalLink, CheckSquare, Square, Trash2, ChevronDown } from 'lucide-react'
import Link from 'next/link'

type Client = {
  id: string
  source: 'member' | 'donor'
  sourceId: number
  name: string
  nameEn: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  active: boolean
  balance: number | null
  totalDonated: number | null
}

type EditingCell = { clientId: string; field: string } | null

function InlineCell({
  value,
  clientId,
  field,
  source,
  sourceId,
  onSave,
  placeholder,
  isEditing,
  onStartEdit,
  onStopEdit,
}: {
  value: string | null
  clientId: string
  field: string
  source: 'member' | 'donor'
  sourceId: number
  onSave: (clientId: string, field: string, newValue: string) => void
  placeholder?: string
  isEditing: boolean
  onStartEdit: (clientId: string, field: string) => void
  onStopEdit: () => void
}) {
  const [localValue, setLocalValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<'success' | 'error' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  async function handleSave() {
    if (localValue === (value ?? '')) {
      onStopEdit()
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/clients/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, id: sourceId, field, value: localValue }),
      })
      if (res.ok) {
        onSave(clientId, field, localValue)
        setFlash('success')
        setTimeout(() => setFlash(null), 1200)
      } else {
        setFlash('error')
        setTimeout(() => setFlash(null), 1500)
        setLocalValue(value ?? '')
      }
    } catch {
      setFlash('error')
      setTimeout(() => setFlash(null), 1500)
      setLocalValue(value ?? '')
    } finally {
      setSaving(false)
      onStopEdit()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setLocalValue(value ?? '')
      onStopEdit()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      handleSave()
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50"
        placeholder={placeholder}
        dir="auto"
      />
    )
  }

  return (
    <div
      onClick={() => onStartEdit(clientId, field)}
      className={`
        px-2 py-1 rounded cursor-pointer text-sm min-h-[28px] transition-colors
        ${flash === 'success' ? 'bg-green-100 text-green-800' : ''}
        ${flash === 'error' ? 'bg-red-100 text-red-800' : ''}
        ${!flash ? 'hover:bg-blue-50 hover:ring-1 hover:ring-blue-200' : ''}
        ${!value ? 'text-gray-300 italic' : 'text-gray-800'}
      `}
      title={value ?? undefined}
    >
      {value || placeholder || '—'}
    </div>
  )
}

export default function ClientsPage() {
  const { lang, T, isRTL } = useLang()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'member' | 'donor'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [deleting, setDeleting] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchClients = useCallback(async (q: string, type: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('search', q)
      if (type !== 'all') params.set('type', type)
      const res = await fetch(`/api/clients?${params}`)
      const data = await res.json()
      setClients(Array.isArray(data) ? data : [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchClients(search, typeFilter), 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [search, typeFilter, fetchClients])

  function handleSave(clientId: string, field: string, newValue: string) {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, [field]: newValue || null } : c
    ))
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === clients.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(clients.map(c => c.id)))
    }
  }

  async function deleteSelected() {
    if (!confirm(T.confirmDelete)) return
    setDeleting(true)
    try {
      const toDelete = clients.filter(c => selected.has(c.id))
      for (const client of toDelete) {
        const url = client.source === 'member'
          ? `/api/members/${client.sourceId}`
          : `/api/donors/${client.sourceId}`
        await fetch(url, { method: 'DELETE' })
      }
      setSelected(new Set())
      fetchClients(search, typeFilter)
    } finally {
      setDeleting(false)
    }
  }

  const allSelected = clients.length > 0 && selected.size === clients.length
  const someSelected = selected.size > 0 && !allSelected

  const heLabel = lang === 'he' ? 'חבר' : 'Member'
  const donorLabel = lang === 'he' ? 'תורם' : 'Donor'
  const pageTitle = lang === 'he' ? 'לקוחות' : 'Clients'
  const allLabel = lang === 'he' ? 'הכל' : 'All'
  const membersLabel = lang === 'he' ? 'חברים' : 'Members'
  const donorsLabel = lang === 'he' ? 'תורמים' : 'Donors'
  const emailPlaceholder = lang === 'he' ? 'לחץ להוספת מייל' : 'Click to add email'
  const phonePlaceholder = lang === 'he' ? 'לחץ להוספת טלפון' : 'Click to add phone'
  const addressPlaceholder = lang === 'he' ? 'לחץ להוספת כתובת' : 'Click to add address'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Users size={22} className="text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-500">
              {lang === 'he' ? 'חברים, תורמים ומבצעי רכישות' : 'Members, donors & purchasers'}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {loading ? T.loading : `${clients.length} ${lang === 'he' ? 'לקוחות' : 'clients'}`}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`${T.search}...`}
            className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as 'all' | 'member' | 'donor')}
            className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pe-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="all">{allLabel}</option>
            <option value="member">{membersLabel}</option>
            <option value="donor">{donorsLabel}</option>
          </select>
          <ChevronDown size={14} className={`absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none ${isRTL ? 'left-2' : 'right-2'}`} />
        </div>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700 font-medium">
            {selected.size} {lang === 'he' ? 'נבחרו' : 'selected'}
          </span>
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {T.delete}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Hint */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600">
          {lang === 'he'
            ? '💡 לחץ על כל תא כדי לערוך — שינויים נשמרים אוטומטית'
            : '💡 Click any cell to edit — changes save automatically'}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="p-3 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-700">
                    {allSelected
                      ? <CheckSquare size={17} className="text-blue-500" />
                      : someSelected
                      ? <CheckSquare size={17} className="text-blue-300" />
                      : <Square size={17} />}
                  </button>
                </th>
                <th className={`p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
                  {T.name}
                </th>
                <th className={`p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'} w-24`}>
                  {lang === 'he' ? 'סוג' : 'Type'}
                </th>
                <th className={`p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'} min-w-[180px]`}>
                  {T.emailLabel}
                </th>
                <th className={`p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'} min-w-[140px]`}>
                  {T.phone}
                </th>
                <th className={`p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'} min-w-[160px] hidden md:table-cell`}>
                  {T.address}
                </th>
                <th className={`p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'} hidden lg:table-cell`}>
                  {lang === 'he' ? 'יתרה / תרומות' : 'Balance / Donated'}
                </th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">{T.loading}</td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">{T.noData}</td>
                </tr>
              ) : (
                clients.map(client => {
                  const isSelected = selected.has(client.id)
                  return (
                    <tr
                      key={client.id}
                      className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3">
                        <button onClick={() => toggleSelect(client.id)} className="text-gray-400 hover:text-gray-700">
                          {isSelected
                            ? <CheckSquare size={17} className="text-blue-500" />
                            : <Square size={17} />}
                        </button>
                      </td>

                      {/* Name */}
                      <td className="p-2">
                        <div>
                          <InlineCell
                            value={client.name}
                            clientId={client.id}
                            field={client.source === 'donor' ? 'name_he' : 'name'}
                            source={client.source}
                            sourceId={client.sourceId}
                            onSave={handleSave}
                            isEditing={editingCell?.clientId === client.id && editingCell?.field === 'name'}
                            onStartEdit={(cid, f) => setEditingCell({ clientId: cid, field: f })}
                            onStopEdit={() => setEditingCell(null)}
                          />
                          {client.nameEn && (
                            <div className="text-xs text-gray-400 px-2">{client.nameEn}</div>
                          )}
                          {!client.active && (
                            <span className="ms-2 text-xs text-red-400">{T.inactive}</span>
                          )}
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="p-2">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          client.source === 'member'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {client.source === 'member' ? heLabel : donorLabel}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="p-2">
                        <InlineCell
                          value={client.email}
                          clientId={client.id}
                          field="email"
                          source={client.source}
                          sourceId={client.sourceId}
                          onSave={handleSave}
                          placeholder={emailPlaceholder}
                          isEditing={editingCell?.clientId === client.id && editingCell?.field === 'email'}
                          onStartEdit={(cid, f) => setEditingCell({ clientId: cid, field: f })}
                          onStopEdit={() => setEditingCell(null)}
                        />
                      </td>

                      {/* Phone */}
                      <td className="p-2">
                        <InlineCell
                          value={client.phone}
                          clientId={client.id}
                          field="phone"
                          source={client.source}
                          sourceId={client.sourceId}
                          onSave={handleSave}
                          placeholder={phonePlaceholder}
                          isEditing={editingCell?.clientId === client.id && editingCell?.field === 'phone'}
                          onStartEdit={(cid, f) => setEditingCell({ clientId: cid, field: f })}
                          onStopEdit={() => setEditingCell(null)}
                        />
                      </td>

                      {/* Address — hidden on mobile */}
                      <td className="p-2 hidden md:table-cell">
                        <InlineCell
                          value={client.address}
                          clientId={client.id}
                          field="address"
                          source={client.source}
                          sourceId={client.sourceId}
                          onSave={handleSave}
                          placeholder={addressPlaceholder}
                          isEditing={editingCell?.clientId === client.id && editingCell?.field === 'address'}
                          onStartEdit={(cid, f) => setEditingCell({ clientId: cid, field: f })}
                          onStopEdit={() => setEditingCell(null)}
                        />
                      </td>

                      {/* Balance / Total Donated — hidden on smaller screens */}
                      <td className="p-2 hidden lg:table-cell">
                        {client.source === 'member' && client.balance !== null && (
                          <span className={`text-sm font-medium ${client.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {client.balance >= 0 ? '+' : ''}{client.balance.toFixed(2)} {T.currency}
                          </span>
                        )}
                        {client.source === 'donor' && client.totalDonated !== null && (
                          <span className="text-sm font-medium text-purple-600">
                            {client.totalDonated.toFixed(2)} {T.currency}
                          </span>
                        )}
                      </td>

                      {/* Link to detail page */}
                      <td className="p-2">
                        <Link
                          href={client.source === 'member' ? `/members/${client.sourceId}` : `/donors/${client.sourceId}`}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title={lang === 'he' ? 'פתח פרטים' : 'Open details'}
                        >
                          <ExternalLink size={15} />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
