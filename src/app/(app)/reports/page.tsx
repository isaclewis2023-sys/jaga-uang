'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, getMonthStart, getMonthEnd } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

type Period = '1m' | '3m' | '6m' | '1y' | 'custom'
type Tab = 'overview' | 'networth'

interface ReportData {
  summary: { totalIncome: number; totalExpense: number; net: number; avgIncomePerMonth: number; avgExpensePerMonth: number }
  monthly: Array<{ month: string; income: number; expense: number; net: number }>
  categoryBreakdown: Array<{ categoryId: string; categoryName: string; color: string; amount: number; percentage: number; count: number }>
  dailySpending: Array<{ date: string; amount: number }>
}

interface NetWorthData {
  snapshots: Array<{ date: string; netWorth: number; breakdown: Record<string, number> }>
  accounts: Record<string, { name: string; icon: string; type: string }>
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

interface NwTooltipPayloadItem {
  value: number
  payload: { date: string; netWorth: number; breakdown: Record<string, number> }
}

const NetWorthTooltip = ({ active, payload, label, accounts }: {
  active?: boolean
  payload?: NwTooltipPayloadItem[]
  label?: string
  accounts: Record<string, { name: string; icon: string; type: string }>
}) => {
  if (!active || !payload?.[0]) return null
  const item = payload[0]
  const breakdown = item.payload?.breakdown ?? {}
  return (
    <div className="matrix-panel p-2 text-xs font-mono border border-[rgba(0,255,65,0.2)] min-w-[160px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      <p className="text-[#3a5c3a] mb-1">{label}</p>
      <p className="text-[#00ff41] font-bold mb-1">{formatIDR(item.value)}</p>
      {Object.entries(breakdown).map(([accId, bal]) => {
        const acc = accounts[accId]
        if (!acc) return null
        return (
          <p key={accId} className="text-[#3a5c3a]">
            {acc.icon} {acc.name}: {formatIDR(bal, true)}
          </p>
        )
      })}
    </div>
  )
}

function getPeriodDates(period: Period, custom: { start: string; end: string }) {
  const now = new Date()
  switch (period) {
    case '1m': return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') }
    case '3m': return { startDate: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') }
    case '6m': return { startDate: format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') }
    case '1y': return { startDate: format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') }
    case 'custom': return { startDate: custom.start, endDate: custom.end }
  }
}

export default function ReportsPage() {
  const { t } = useLanguage()
  const [tab, setTab] = useState<Tab>('overview')
  const [period, setPeriod] = useState<Period>('1m')
  const [custom, setCustom] = useState({ start: getMonthStart(), end: getMonthEnd() })
  const [data, setData] = useState<ReportData | null>(null)
  const [nwData, setNwData] = useState<NetWorthData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p: Period = period, c = custom) => {
    setLoading(true)
    const { startDate, endDate } = getPeriodDates(p, c)
    try {
      const [repRes, nwRes] = await Promise.all([
        fetch(`/api/reports?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/networth?startDate=${startDate}&endDate=${endDate}`),
      ])
      const [rep, nw] = await Promise.all([repRes.json(), nwRes.json()])
      setData(rep)
      setNwData(nw)
    } catch {}
    setLoading(false)
  }, [period, custom])

  useEffect(() => { load() }, [load])

  const periods: Array<{ key: Period; label: string }> = [
    { key: '1m', label: t.reports.oneMonth },
    { key: '3m', label: t.reports.threeMonths },
    { key: '6m', label: t.reports.sixMonths },
    { key: '1y', label: t.reports.oneYear },
    { key: 'custom', label: t.reports.custom },
  ]

  const nwSnapshots = nwData?.snapshots ?? []
  const nwAccounts = nwData?.accounts ?? {}
  const latestNw = nwSnapshots[nwSnapshots.length - 1]?.netWorth ?? 0
  const firstNw = nwSnapshots[0]?.netWorth ?? 0
  const nwDelta = latestNw - firstNw
  const nwColor = nwDelta >= 0 ? '#00ff41' : '#ff2055'

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <GlitchText text={t.reports.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />

      {/* Tabs */}
      <div className="flex gap-1">
        {([
          { key: 'overview', label: t.reports.overview },
          { key: 'networth', label: t.reports.netWorthTab },
        ] as Array<{ key: Tab; label: string }>).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`matrix-btn matrix-btn-sm ${tab === key ? 'matrix-btn-solid' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <NeonCard className="p-3" animate={false}>
        <div className="flex flex-wrap gap-2 items-center">
          {periods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setPeriod(key); load(key) }}
              className={`matrix-btn matrix-btn-sm ${period === key ? 'matrix-btn-solid' : ''}`}
            >
              {label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex gap-2 ml-2">
              <input type="date" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} className="matrix-input text-xs" style={{ width: 140, colorScheme: 'dark' }} />
              <span className="text-[#3a5c3a] self-center font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>—</span>
              <input type="date" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} className="matrix-input text-xs" style={{ width: 140, colorScheme: 'dark' }} />
              <button onClick={() => load('custom', custom)} className="matrix-btn matrix-btn-solid matrix-btn-sm">&gt; OK</button>
            </div>
          )}
        </div>
      </NeonCard>

      {loading ? (
        <div className="text-center py-16"><span className="font-mono text-[#00b347] cursor-blink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; MEMUAT LAPORAN</span></div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t.reports.totalIncome, value: data.summary.totalIncome, color: '#00ff41' },
                  { label: t.reports.totalExpense, value: data.summary.totalExpense, color: '#ff2055' },
                  { label: t.reports.netAmount, value: data.summary.net, color: data.summary.net >= 0 ? '#00ff41' : '#ff2055' },
                  { label: t.reports.avgPerMonth, value: data.summary.avgExpensePerMonth, color: '#ffd700' },
                ].map(({ label, value, color }, i) => (
                  <NeonCard key={i} className="p-3 text-center" delay={i * 0.07}>
                    <p className="matrix-label mb-1 text-[0.6rem]">{label}</p>
                    <div className="font-mono font-bold text-sm sm:text-base" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>
                      {formatIDR(value)}
                    </div>
                  </NeonCard>
                ))}
              </div>

              {/* Monthly bar chart */}
              <NeonCard className="p-4" delay={0.2}>
                <p className="matrix-label mb-4">{t.reports.monthlyComparison}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.monthly} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: '#3a5c3a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#3a5c3a', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}jt`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#3a5c3a' }} />
                    <Bar dataKey="income" name="Masuk" fill="#00ff41" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expense" name="Keluar" fill="#ff2055" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </NeonCard>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Cash flow */}
                <NeonCard className="p-4" delay={0.25}>
                  <p className="matrix-label mb-4">{t.reports.cashFlow}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: '#3a5c3a', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#3a5c3a', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}jt`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="net" name="Net" stroke="#00e5ff" strokeWidth={2} dot={{ r: 3, fill: '#00e5ff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </NeonCard>

                {/* Category donut */}
                <NeonCard className="p-4" delay={0.3}>
                  <p className="matrix-label mb-3">{t.reports.categoryBreakdown} ({t.transactions.expense})</p>
                  {data.categoryBreakdown.length === 0 ? (
                    <p className="text-[#3a5c3a] font-mono text-xs text-center py-8" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.common.noData}</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <PieChart width={120} height={120}>
                        <Pie data={data.categoryBreakdown} dataKey="amount" cx={60} cy={60} innerRadius={35} outerRadius={55} strokeWidth={0} animationBegin={0} animationDuration={800}>
                          {data.categoryBreakdown.map((c, i) => (
                            <Cell key={i} fill={c.color} fillOpacity={0.85} />
                          ))}
                        </Pie>
                      </PieChart>
                      <div className="flex-1 space-y-1.5 overflow-hidden">
                        {data.categoryBreakdown.slice(0, 6).map((c) => (
                          <div key={c.categoryId} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                              <span className="font-mono text-xs text-[#c8ffc8] truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{c.categoryName}</span>
                            </div>
                            <span className="font-mono text-xs shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace', color: c.color }}>{c.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </NeonCard>
              </div>

              {/* Category table */}
              <NeonCard className="p-4" delay={0.35}>
                <p className="matrix-label mb-3">{t.reports.categoryBreakdown}</p>
                <div className="overflow-x-auto">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th>{t.transactions.category}</th>
                        <th className="text-right">{t.transactions.amount}</th>
                        <th className="text-right">%</th>
                        <th className="text-right">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categoryBreakdown.map((c) => (
                        <tr key={c.categoryId}>
                          <td className="font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: c.color }}>{c.categoryName}</td>
                          <td className="text-right font-mono text-sm font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ff2055' }}>
                            {formatIDR(c.amount)}
                          </td>
                          <td className="text-right font-mono text-xs text-[#3a5c3a]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{c.percentage}%</td>
                          <td className="text-right font-mono text-xs text-[#3a5c3a]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </NeonCard>
            </motion.div>
          )}

          {/* ── NET WORTH TAB ── */}
          {tab === 'networth' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Note */}
              <p className="text-[#3a5c3a] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                ⓘ {t.reports.netWorthNote}
              </p>

              {nwSnapshots.length === 0 ? (
                <NeonCard className="p-8 text-center" animate={false}>
                  <p className="text-[#3a5c3a] font-mono text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.common.noData}</p>
                </NeonCard>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Awal Periode', value: firstNw, color: '#3a5c3a' },
                      { label: 'Akhir Periode', value: latestNw, color: nwColor },
                      { label: 'Perubahan', value: nwDelta, color: nwColor },
                    ].map(({ label, value, color }, i) => (
                      <NeonCard key={i} className="p-3 text-center" delay={i * 0.06}>
                        <p className="matrix-label text-[0.55rem] mb-1">{label}</p>
                        <p className="font-mono font-bold text-xs sm:text-sm" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                          {value >= 0 ? '' : '-'}{formatIDR(Math.abs(value), true)}
                        </p>
                      </NeonCard>
                    ))}
                  </div>

                  {/* Area chart */}
                  <NeonCard className="p-4" delay={0.2}>
                    <p className="matrix-label mb-4">{t.reports.netWorthHistory}</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={nwSnapshots}>
                        <defs>
                          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={nwColor} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={nwColor} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.06)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#3a5c3a', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: string) => v.slice(5)}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fill: '#3a5c3a', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${(v/1e6).toFixed(0)}jt`}
                        />
                        <Tooltip content={(props) => <NetWorthTooltip active={props.active} payload={props.payload as unknown as NwTooltipPayloadItem[]} label={String(props.label ?? '')} accounts={nwAccounts} />} />
                        <Area
                          type="monotone"
                          dataKey="netWorth"
                          name={t.dashboard.netWorth}
                          stroke={nwColor}
                          strokeWidth={2}
                          fill="url(#nwGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: nwColor }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </NeonCard>

                  {/* Account breakdown table */}
                  {Object.keys(nwAccounts).length > 0 && latestNw !== undefined && (
                    <NeonCard className="p-4" delay={0.3}>
                      <p className="matrix-label mb-3">Breakdown Akun (Akhir Periode)</p>
                      <div className="space-y-2">
                        {Object.entries(nwAccounts).map(([accId, acc]) => {
                          const bal = nwSnapshots[nwSnapshots.length - 1]?.breakdown?.[accId] ?? 0
                          const displayBal = acc.type === 'credit' ? -bal : bal
                          return (
                            <div key={accId} className="flex items-center justify-between py-1.5 px-2 rounded border border-[rgba(0,255,65,0.05)]">
                              <div className="flex items-center gap-2">
                                <span>{acc.icon}</span>
                                <span className="font-mono text-xs text-[#c8ffc8]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{acc.name}</span>
                                <span className="matrix-badge text-[0.55rem]">{acc.type}</span>
                              </div>
                              <span className="font-mono text-sm font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', color: displayBal >= 0 ? '#00ff41' : '#ff2055' }}>
                                {formatIDR(displayBal, true)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </NeonCard>
                  )}
                </>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
