'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { User } from '@/lib/db'
import { ArrowLeft, Edit2, Save, X, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function AdminUsersPage() {
  const { lang, T, isRTL } = useLang()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<{
    username: string
    password: string
    role: 'super_admin' | 'user'
  }>({ username: '', password: '', role: 'user' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        if (res.status === 403) {
          setError(lang === 'he' ? 'אתה לא מנהל עליון' : 'You are not a super admin')
        } else {
          setError(lang === 'he' ? 'שגיאה בטעינת משתמשים' : 'Failed to load users')
        }
        return
      }
      const data = await res.json()
      setUsers(data)
    } catch (e) {
      setError(lang === 'he' ? 'שגיאה בטעינת משתמשים' : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id)
    setFormData({ username: user.username, password: '', role: user.role })
  }

  function cancelEdit() {
    setEditingId(null)
    setFormData({ username: '', password: '', role: 'user' })
  }

  async function saveUser() {
    if (!formData.username.trim()) {
      setError(lang === 'he' ? 'שם משתמש חסר' : 'Username is required')
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password || undefined,
          role: formData.role,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || (lang === 'he' ? 'שגיאה בעדכון משתמש' : 'Failed to update user'))
        return
      }

      await loadUsers()
      cancelEdit()
      setError('')
    } catch (e) {
      setError(lang === 'he' ? 'שגיאה בעדכון משתמש' : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const roleOptions = [
    { value: 'super_admin', label: lang === 'he' ? 'מנהל עליון' : 'Super Admin' },
    { value: 'user', label: lang === 'he' ? 'משתמש' : 'User' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              {lang === 'he' ? 'ניהול משתמשים' : 'User Management'}
            </h1>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{lang === 'he' ? 'טוען...' : 'Loading...'}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{lang === 'he' ? 'אין משתמשים' : 'No users'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      {lang === 'he' ? 'שם משתמש' : 'Username'}
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      {lang === 'he' ? 'שם תצוגה' : 'Display Name'}
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      {lang === 'he' ? 'תפקיד' : 'Role'}
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      {lang === 'he' ? 'פעולות' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      {editingId === user.id ? (
                        <>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={formData.username}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  username: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={lang === 'he' ? 'שם משתמש' : 'Username'}
                            />
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {user.display_name}
                          </td>
                          <td className="px-6 py-3">
                            <select
                              value={formData.role}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  role: e.target.value as 'super_admin' | 'user',
                                }))
                              }
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              {roleOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-3 space-y-2">
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  password: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder={lang === 'he' ? 'סיסמה חדשה (אופציונלי)' : 'New password (optional)'}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveUser}
                                disabled={saving}
                                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                              >
                                <Save size={16} />
                                {lang === 'he' ? 'שמור' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-sm font-medium"
                              >
                                <X size={16} />
                                {lang === 'he' ? 'בטל' : 'Cancel'}
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">
                            {user.username}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {user.display_name}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                user.role === 'super_admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {user.role === 'super_admin'
                                ? lang === 'he'
                                  ? 'מנהל עליון'
                                  : 'Super Admin'
                                : lang === 'he'
                                ? 'משתמש'
                                : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => startEdit(user)}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                            >
                              <Edit2 size={16} />
                              {lang === 'he' ? 'ערוך' : 'Edit'}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
