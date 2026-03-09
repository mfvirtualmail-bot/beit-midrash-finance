'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, BarChart2, Users, Menu, X, LogOut, Heart, FileText, RefreshCw, ShoppingCart } from 'lucide-react'
import { LangProvider, useLang } from '@/lib/LangContext'
import { useState, useEffect } from 'react'

type AuthUser = { id: number; username: string; display_name: string } | null

function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, T, isRTL } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<AuthUser>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me').then(r => r.json()).then(setUser).catch(() => {})
    }
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  if (pathname === '/login') {
    return (
      <html lang={lang} dir={isRTL ? 'rtl' : 'ltr'}>
        <body>{children}</body>
      </html>
    )
  }

  const navItems = [
    { href: '/', label: T.dashboard, icon: LayoutDashboard },
    { href: '/transactions', label: T.transactions, icon: ArrowLeftRight },
    { href: '/purchases', label: lang === 'he' ? 'רכישות שבועיות' : 'Weekly Purchases', icon: ShoppingCart },
    { href: '/recurring', label: T.recurring, icon: RefreshCw },
    { href: '/members', label: T.members, icon: Users },
    { href: '/donors', label: T.donors, icon: Heart },
    { href: '/invoices', label: T.invoices, icon: FileText },
    { href: '/categories', label: T.categories, icon: Tag },
    { href: '/reports', label: T.reports, icon: BarChart2 },
  ]

  return (
    <html lang={lang} dir={isRTL ? 'rtl' : 'ltr'}>
      <body>
        <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
          <header className="bg-blue-700 text-white shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🕍</span>
                <span className="font-bold text-lg">{T.appName}</span>
              </div>
              <div className="flex items-center gap-3">
                {user && (
                  <span className="text-sm text-blue-100 hidden sm:block">
                    {T.welcomeUser}, <span className="font-semibold text-white">{user.display_name.split('/')[0].trim()}</span>
                  </span>
                )}
                <button
                  onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
                  className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  {T.switchLang}
                </button>
                {user && (
                  <button
                    onClick={handleLogout}
                    className="text-sm bg-blue-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                    title={T.logout}
                  >
                    <LogOut size={14} />
                    <span className="hidden sm:inline">{T.logout}</span>
                  </button>
                )}
                <button className="sm:hidden p-2 rounded hover:bg-blue-600" onClick={() => setMenuOpen(!menuOpen)}>
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-1">
            <aside className={`
              fixed sm:static top-16 ${isRTL ? 'right-0' : 'left-0'} bottom-0 z-40
              w-56 bg-white border-e border-gray-200 shadow-sm
              transition-transform duration-200 ease-in-out
              ${menuOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full sm:translate-x-0' : '-translate-x-full sm:translate-x-0')}
            `}>
              <nav className="p-4 space-y-1 mt-2">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                  return (
                    <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                        ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  )
                })}
              </nav>
            </aside>

            {menuOpen && <div className="fixed inset-0 bg-black/30 z-30 sm:hidden" onClick={() => setMenuOpen(false)} />}

            <main className="flex-1 p-4 sm:p-6 overflow-auto">
              <div className="max-w-6xl mx-auto">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <Shell>{children}</Shell>
    </LangProvider>
  )
}
