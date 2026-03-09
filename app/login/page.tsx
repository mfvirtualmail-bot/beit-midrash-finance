'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

export default function LoginPage() {
  const { T, isRTL } = useLang()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(T.invalidCredentials)
      }
    } catch {
      setError(T.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🕍</span>
          <h1 className="text-xl font-bold text-gray-800 mt-3">{T.appName}</h1>
          <p className="text-gray-500 text-sm mt-1">{T.loginTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{T.username}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input w-full"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{T.password}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input w-full"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? T.loading : T.login}
          </button>
        </form>
      </div>
    </div>
  )
}
