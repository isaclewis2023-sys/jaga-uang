'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Wallet, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw, Plus
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { motion } from 'framer-motion'
import NeonCard from '@/components/matrix/NeonCard'
import CounterNumber from '@/components/matrix/CounterNumber'
import GlitchText from '@/components/matrix/GlitchText'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, formatDate, getMonthStart, getMonthEnd, getHealthColor, getProgressPercentage } from '@/lib/utils'
import type { Account, Transaction } from '@/types'

interface DashboardData {
  accounts: Account[]
  transactions: Transaction[]
  health: {
    total: number
    label: string
    savingsRate: number
    emergencyMonths: number
    savingsScore: number
    budgetScore: number
    emergencyScore: number
    goalScore: number
  }
  budgets: Array<{ id: string; categoryId: string; amount: number; spent: number; category?: { name: string; color: string; icon?: string } }>
}

function HealthGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="80" viewBox="0 0 140 85">
        <defs>
          <filter id="glow-gauge">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke="rgba(0,255,65,0.1)"
          strokeWidth="10"
          strokeDasharray={`${circ * 0.5} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(180 70 70)"
        />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash * 0.5} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(180 70 70)"
          filter="url(#glow-gauge)"
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
        {/* Score */}
        <text x="70" y="64" textAnchor="middle" fill={color} fontSize="24" fontWeight="700" fontFamily="JetBrains Mono, monospace" filter="url(#glow-gauge)">
          {score}
        </text>
      </svg>
      <span className="font-mono font-bold text-sm tracking-widest" style={{ color, fontFamily: 'JetBrains Mono, monospace', textShadow: `0 0 8px ${color}` }}>
        {label}
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="matrix-panel p-2 text-xs font-mono border border-[rgba(0,255,65,0.2)]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      <p className="text-[#3a5c3a] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatIDR(p.value)}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [chartData, setChartData] = useState<Array<{ month: string; income: number; expense: number }>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date()
      const startDate = getMonthStart(today.getFullYear(), today.getMonth() + 1)
      const endDate = getMonthEnd(today.getFullYear(), today.getMonth() + 1)

      const [accsRes, txsRes, healthRes, budgetsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch(`/api/transactions?limit=10`),
        fetch('/api/health'),
        fetch(`/api/budget?month=${today.getMonth() + 1}&year=${today.getFullYear()}`),
      ])

      const [accounts, transactions, health, budgets] = await Promise.all([
        accsRes.json(), txsRes.json(), healthRes.json(), budgetsRes.json()
      ])

      setData({ accounts, transactions, health, budgets })

      // Chart data: last 6 months
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      const chartStart = sixMonthsAgo.toISOString().split('T')[0].slice(0, 7) + '-01'
      const chartEnd = endDate

      const reportRes = await fetch(`/api/reports?startDate=${chartStart}&endDate=${chartEnd}`)
      const report = await reportRes.json()
      setChartData(report.monthly?.map((m: { month: string; income: number; expense: number }) => ({
        month: m.month.slice(0, 7),
        income: m.income,
        expense: m.expense,
      })) ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Process recurring on load
  useEffect(() => {
    fetch('/api/recurring', { method: 'PUT' }).catch(() => {})
  }, [])

  const accounts: Account[] = data?.accounts ?? []
  const transactions: Transaction[] = data?.transactions ?? []
  const health = data?.health
  const budgets = data?.budgets ?? []

  const netWorth = accounts.reduce((s, a) => s + (a.type === 'credit' ? -a.balance : a.balance), 0)

  const today = new Date()
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  const monthTxs = transactions.filter((t) => {
    const d = new Date(t.date)
    return d.getMonth() + 1 === month && d.getFullYear() === year
  })
  const monthIncome = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <div className="text-[#00b347] text-sm mb-2 cursor-blink">&gt; MEMUAT DASHBOARD</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <GlitchText text={t.dashboard.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />
          <p className="text-[#3a5c3a] font-mono text-xs mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            &gt; {new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} className="matrix-btn matrix-btn-sm matrix-btn-icon">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Net Worth */}
      <NeonCard className="p-5 text-center" glow>
        <p className="matrix-label mb-2">{t.dashboard.netWorth}</p>
        <div className="text-3xl sm:text-4xl font-bold font-mono text-glow" style={{ fontFamily: 'JetBrains Mono, monospace', color: netWorth >= 0 ? '#00ff41' : '#ff2055' }}>
          <CounterNumber value={netWorth} currency duration={1200} />
        </div>
        <p className="text-[#3a5c3a] font-mono text-xs mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {accounts.length} {t.accounts.title.toLowerCase()}
        </p>
      </NeonCard>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {[
          { label: t.dashboard.totalIncome, value: monthIncome, icon: TrendingUp, color: '#00ff41', glow: 'text-glow' },
          { label: t.dashboard.totalExpense, value: monthExpense, icon: TrendingDown, color: '#ff2055', glow: 'text-glow-red' },
          { label: t.dashboard.netBalance, value: monthIncome - monthExpense, icon: Wallet, color: monthIncome - monthExpense >= 0 ? '#00ff41' : '#ff2055', glow: monthIncome - monthExpense >= 0 ? 'text-glow' : 'text-glow-red' },
          { label: t.dashboard.savingsRate, value: monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0, icon: Activity, color: '#00e5ff', glow: 'text-glow-cyan', suffix: '%', currency: false },
        ].map(({ label, value, icon: Icon, color, glow, suffix, currency = true }, i) => (
          <NeonCard key={i} className="p-3" delay={i * 0.07}>
            <div className="flex items-start justify-between mb-2">
              <span className="matrix-label text-[0.6rem]">{label}</span>
              <Icon size={13} style={{ color }} />
            </div>
            <div className={`font-bold font-mono text-sm sm:text-base ${glow}`} style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
              <CounterNumber
                value={value}
                currency={currency}
                compact={currency}
                suffix={suffix}
                duration={900}
              />
            </div>
            <p className="text-[#3a5c3a] font-mono text-[0.6rem] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {t.dashboard.thisMonth}
            </p>
          </NeonCard>
        ))}
      </motion.div>

      {/* Chart + Health */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Chart */}
        <NeonCard className="md:col-span-2 p-4" delay={0.2}>
          <div className="flex items-center justify-between mb-4">
            <p className="matrix-label">{t.dashboard.incomeVsExpense}</p>
            <span className="text-[#3a5c3a] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>6M</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff41" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00ff41" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff2055" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ff2055" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#3a5c3a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a5c3a', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}jt`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income" name="Masuk" stroke="#00ff41" strokeWidth={2} fill="url(#incomeGrad)" dot={false} />
              <Area type="monotone" dataKey="expense" name="Keluar" stroke="#ff2055" strokeWidth={2} fill="url(#expenseGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </NeonCard>

        {/* Health Score */}
        <NeonCard className="p-4 flex flex-col items-center justify-center" delay={0.25}>
          <p className="matrix-label mb-3 self-start">{t.dashboard.healthScore}</p>
          {health && (
            <>
              <HealthGauge score={health.total} label={health.label} color={getHealthColor(health.total)} />
              <div className="w-full mt-4 space-y-2">
                {[
                  { label: 'Savings', score: health.savingsScore, max: 30 },
                  { label: 'Budget', score: health.budgetScore, max: 25 },
                  { label: 'Emergency', score: health.emergencyScore, max: 25 },
                  { label: 'Goals', score: health.goalScore, max: 20 },
                ].map(({ label, score, max }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[#3a5c3a] font-mono text-[0.6rem]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
                      <span className="text-[#00b347] font-mono text-[0.6rem]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{score}/{max}</span>
                    </div>
                    <div className="matrix-progress h-1.5">
                      <motion.div
                        className="matrix-progress-bar"
                        style={{ background: getHealthColor(Math.round((score / max) * 100)) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(score / max) * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </NeonCard>
      </div>

      {/* Accounts + Budgets */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Accounts */}
        <NeonCard className="p-4" delay={0.3}>
          <div className="flex items-center justify-between mb-3">
            <p className="matrix-label">{t.dashboard.accountsOverview}</p>
            <button onClick={() => router.push('/accounts')} className="text-[#3a5c3a] hover:text-[#00b347] font-mono text-xs transition-colors" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {t.dashboard.viewAll} →
            </button>
          </div>
          {accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[#3a5c3a] font-mono text-xs mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.accounts.noAccounts}</p>
              <button onClick={() => router.push('/accounts')} className="matrix-btn matrix-btn-sm">
                <Plus size={11} /> {t.accounts.addAccount}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.slice(0, 5).map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-1.5 px-2 rounded border border-[rgba(0,255,65,0.05)] hover:border-[rgba(0,255,65,0.15)] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{acc.icon}</span>
                    <div>
                      <p className="text-[#c8ffc8] font-mono text-xs font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{acc.name}</p>
                      <p className="text-[#3a5c3a] font-mono text-[0.6rem] uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{acc.type}</p>
                    </div>
                  </div>
                  <span className={`font-mono font-bold text-sm ${acc.balance >= 0 ? 'text-[#00ff41]' : 'text-[#ff2055]'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatIDR(acc.balance, true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </NeonCard>

        {/* Budget Overview */}
        <NeonCard className="p-4" delay={0.35}>
          <div className="flex items-center justify-between mb-3">
            <p className="matrix-label">{t.dashboard.budgetOverview}</p>
            <button onClick={() => router.push('/budget')} className="text-[#3a5c3a] hover:text-[#00b347] font-mono text-xs transition-colors" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {t.dashboard.viewAll} →
            </button>
          </div>
          {budgets.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[#3a5c3a] font-mono text-xs mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.budget.noBudgets}</p>
              <button onClick={() => router.push('/budget')} className="matrix-btn matrix-btn-sm">
                <Plus size={11} /> {t.budget.addBudget}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {budgets.slice(0, 4).map((b) => {
                const pct = getProgressPercentage(b.spent, b.amount)
                const barColor = pct >= 100 ? '#ff2055' : pct >= 75 ? '#ffd700' : '#00ff41'
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#c8ffc8] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {b.category?.icon} {b.category?.name}
                      </span>
                      <span className="font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: barColor }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="matrix-progress h-1.5">
                      <motion.div
                        className="matrix-progress-bar"
                        style={{ background: barColor, width: `${Math.min(pct, 100)}%` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.7 }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[#3a5c3a] font-mono text-[0.6rem]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatIDR(b.spent, true)}</span>
                      <span className="text-[#3a5c3a] font-mono text-[0.6rem]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>/ {formatIDR(b.amount, true)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </NeonCard>
      </div>

      {/* Recent Transactions */}
      <NeonCard className="p-4" delay={0.4}>
        <div className="flex items-center justify-between mb-3">
          <p className="matrix-label">{t.dashboard.recentTransactions}</p>
          <button onClick={() => router.push('/transactions')} className="text-[#3a5c3a] hover:text-[#00b347] font-mono text-xs transition-colors" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {t.dashboard.viewAll} →
          </button>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[#3a5c3a] font-mono text-xs mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.transactions.noTransactions}</p>
            <button onClick={() => router.push('/transactions')} className="matrix-btn matrix-btn-sm">
              <Plus size={11} /> {t.transactions.addTransaction}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>{t.transactions.date}</th>
                  <th>{t.transactions.description}</th>
                  <th className="hidden sm:table-cell">{t.transactions.category}</th>
                  <th className="text-right">{t.transactions.amount}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id}>
                    <td className="text-[#3a5c3a] font-mono text-xs whitespace-nowrap" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {formatDate(tx.date, 'dd/MM', lang)}
                    </td>
                    <td className="font-mono text-xs text-[#c8ffc8] max-w-[140px] truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {tx.description}
                    </td>
                    <td className="hidden sm:table-cell">
                      {tx.category && (
                        <span className="matrix-badge" style={{ background: `${tx.category.color}18`, color: tx.category.color, border: `1px solid ${tx.category.color}30` }}>
                          {tx.category.icon} {tx.category.name}
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono font-semibold text-sm whitespace-nowrap" style={{ fontFamily: 'JetBrains Mono, monospace', color: tx.type === 'income' ? '#00ff41' : '#ff2055' }}>
                      {tx.type === 'income' ? '+' : '-'}{formatIDR(tx.amount, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NeonCard>
    </div>
  )
}
