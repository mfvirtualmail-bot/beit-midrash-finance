'use client'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { User, Lock, CheckCircle, AlertCircle } from 'lucide-react'

interface AuthUser {
  id: number
  username: string
  display_name: string
}

export default function ProfilePage() {
  const { T, lang } = useLang()
  const [user, setUser] = useState<AuthUser | null>(null)

  // Profile form
  const [profileForm, setProfileForm] = useState({ username: '', display_name: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Password form
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(u => {
      if (u) {
        setUser(u)
        setProfileForm({ username: u.username, display_name: u.display_name })
      }
    })
  }, [])

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm),
    })
    const data = await res.json()
    if (res.ok) {
      setProfileMsg({ type: 'ok', text: T.profileSaved })
      setUser(u => u ? { ...u, username: profileForm.username, display_name: profileForm.display_name } : u)
    } else {
      const errMap: Record<string, string> = {
        'Username already taken': T.usernameTaken,
      }
      setProfileMsg({ type: 'err', text: errMap[data.error] ?? data.error ?? T.error })
    }
    setProfileSaving(false)
    setTimeout(() => setProfileMsg(null), 5000)
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg({ type: 'err', text: T.passwordMismatch })
      return
    }
    if (pwdForm.newPassword.length < 4) {
      setPwdMsg({ type: 'err', text: lang === 'he' ? 'הסיסמה חייבת להכיל לפחות 4 תווים' : 'Password must be at least 4 characters' })
      return
    }
    setPwdSaving(true)
    setPwdMsg(null)
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwdMsg({ type: 'ok', text: T.passwordChanged })
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      const errMap: Record<string, string> = {
        'Wrong password': T.wrongPassword,
      }
      setPwdMsg({ type: 'err', text: errMap[data.error] ?? data.error ?? T.error })
    }
    setPwdSaving(false)
    setTimeout(() => setPwdMsg(null), 5000)
  }

  if (!user) return <div className="text-center py-16 text-gray-400">{T.loading}</div>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <User size={24} className="text-blue-600" />
        {T.myProfile}
      </h1>

      {/* Profile Section */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <User size={16} className="text-blue-500" />
          {lang === 'he' ? 'פרטי חשבון' : 'Account Details'}
        </h2>

        {profileMsg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${profileMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {profileMsg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="label">{T.username} *</label>
            <input
              className="input w-full"
              value={profileForm.username}
              onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">{T.displayName}</label>
            <input
              className="input w-full"
              value={profileForm.display_name}
              onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder={lang === 'he' ? 'שם לתצוגה' : 'Display name'}
            />
            <p className="text-xs text-gray-400 mt-1">
              {lang === 'he' ? 'השם שמוצג בפינה העליונה' : 'The name shown in the top corner'}
            </p>
          </div>
          <button type="submit" disabled={profileSaving} className="btn-primary w-full">
            {profileSaving ? T.loading : T.save}
          </button>
        </form>
      </div>

      {/* Password Section */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Lock size={16} className="text-amber-500" />
          {T.changePassword}
        </h2>

        {pwdMsg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${pwdMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {pwdMsg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {pwdMsg.text}
          </div>
        )}

        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div>
            <label className="label">{T.currentPassword} *</label>
            <input
              type="password"
              className="input w-full"
              value={pwdForm.currentPassword}
              onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">{T.newPassword} *</label>
            <input
              type="password"
              className="input w-full"
              value={pwdForm.newPassword}
              onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">{T.confirmPassword} *</label>
            <input
              type="password"
              className="input w-full"
              value={pwdForm.confirmPassword}
              onChange={e => setPwdForm(f => ({ ...f, confirmPassword: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={pwdSaving} className="btn-primary w-full">
            {pwdSaving ? T.loading : T.changePassword}
          </button>
        </form>
      </div>
    </div>
  )
}
