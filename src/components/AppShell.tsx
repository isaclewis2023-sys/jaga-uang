'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, BarChart3,
  Target, PiggyBank, Settings, LogOut, ChevronLeft,
  ChevronRight, Globe, Terminal, Bot
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import QuickAddFAB from '@/components/QuickAddFAB'

const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'transactions', href: '/transactions', icon: ArrowLeftRight },
  { key: 'accounts', href: '/accounts', icon: Wallet },
  { key: 'reports', href: '/reports', icon: BarChart3 },
  { key: 'budget', href: '/budget', icon: PiggyBank },
  { key: 'goals', href: '/goals', icon: Target },
  { key: 'ai', href: '/ai', icon: Bot },
  { key: 'settings', href: '/settings', icon: Settings },
] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t, lang, setLang } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const navLabels: Record<string, string> = {
    dashboard: t.nav.dashboard,
    transactions: t.nav.transactions,
    accounts: t.nav.accounts,
    reports: t.nav.reports,
    budget: t.nav.budget,
    goals: t.nav.goals,
    ai: 'ARIA',
    settings: t.nav.settings,
  }

  return (
    <div className="flex min-h-dvh bg-[#030303]">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out',
          'matrix-panel border-r border-[rgba(0,255,65,0.1)] relative',
          collapsed ? 'w-14' : 'w-52'
        )}
        style={{ zIndex: 10 }}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-4 border-b border-[rgba(0,255,65,0.1)]',
            collapsed && 'justify-center'
          )}
        >
          <Terminal size={16} className="text-[#00ff41] shrink-0 text-glow-sm" />
          {!collapsed && (
            <span
              className="font-bold text-[#00ff41] text-glow-sm tracking-wider text-sm truncate"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              JAGA UANG
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-hidden">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <button
                key={key}
                onClick={() => router.push(href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 text-left group',
                  'font-mono text-xs tracking-wider',
                  collapsed ? 'justify-center' : '',
                  active
                    ? 'text-[#00ff41] bg-[rgba(0,255,65,0.08)] border-l-2 border-[#00ff41]'
                    : 'text-[#3a5c3a] hover:text-[#00b347] hover:bg-[rgba(0,255,65,0.04)] border-l-2 border-transparent'
                )}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
                title={collapsed ? navLabels[key] : undefined}
              >
                <Icon
                  size={14}
                  className={cn(
                    'shrink-0 transition-all duration-150',
                    active ? 'text-[#00ff41]' : 'text-[#3a5c3a] group-hover:text-[#00b347]',
                    active && 'drop-shadow-[0_0_4px_#00ff41]'
                  )}
                />
                {!collapsed && <span className="truncate">{navLabels[key]}</span>}
              </button>
            )
          })}
        </nav>

        {/* Bottom controls */}
        <div className="pb-3 px-2 space-y-1 border-t border-[rgba(0,255,65,0.08)] pt-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded text-[#3a5c3a] hover:text-[#00b347] transition-colors',
              'font-mono text-xs',
              collapsed && 'justify-center'
            )}
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
            title="Toggle language"
          >
            <Globe size={13} className="shrink-0" />
            {!collapsed && <span>{lang === 'id' ? 'ID / EN' : 'EN / ID'}</span>}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded text-[#3a5c3a] hover:text-[#ff2055] transition-colors',
              'font-mono text-xs',
              collapsed && 'justify-center'
            )}
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            <LogOut size={13} className="shrink-0" />
            {!collapsed && <span>{t.auth.logout}</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 w-6 h-6 matrix-panel border border-[rgba(0,255,65,0.2)] rounded-full flex items-center justify-center text-[#00b347] hover:text-[#00ff41] transition-colors z-20"
          style={{ boxShadow: '0 0 8px rgba(0,255,65,0.1)' }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar on mobile / tablet */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 matrix-panel border-b border-[rgba(0,255,65,0.1)] sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[#00ff41]" />
            <span className="font-bold text-[#00ff41] text-sm tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              JAGA UANG
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
              className="text-[#3a5c3a] hover:text-[#00b347] transition-colors"
            >
              <Globe size={14} />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-[#3a5c3a] hover:text-[#ff2055] transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Quick Add FAB */}
      <QuickAddFAB />

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 matrix-panel border-t border-[rgba(0,255,65,0.12)] flex">
        {NAV_ITEMS.filter((n) => ['dashboard','transactions','accounts','ai','settings'].includes(n.key)).map(
          ({ key, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <button
                key={key}
                onClick={() => router.push(href)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all',
                  active ? 'text-[#00ff41]' : 'text-[#3a5c3a]'
                )}
              >
                <Icon
                  size={18}
                  className={cn(active && 'drop-shadow-[0_0_4px_#00ff41]')}
                />
                <span
                  className="font-mono text-center"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.04em' }}
                >
                  {navLabels[key]}
                </span>
              </button>
            )
          }
        )}
      </nav>
    </div>
  )
}
