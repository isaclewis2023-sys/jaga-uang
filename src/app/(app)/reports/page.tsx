'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, Cell, PieChart, Pie
} from 'recharts'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, getMonthStart, getMonthEnd } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

type Period = '1m' | '3m' | '6m' | '1y' | 'custom'

interface ReportData {
  summary: { totalIncome: number; totalExpense: number; net: number; avgIncomePerMonth: number; avgExpensePerMonth: number }
  monthly: Array<{ month: string; income: number; expense: number; net: number }>
  categoryBreakdown: Array<{ categoryId: string; categoryName: string; color: string; amount: number; percentage: number; count: number }>
  dailySpending: Array<{ date: string; amount: number }>
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
  const [period, setPeriod] = useState<Period>('1m')
  const [custom, setCustom] = useState({ start: getMonthStart(), end: getMonthEnd() })
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p: Period = period, c = custom) => {
    setLoading(true)
    const { startDate, endDate } = getPeriodDates(p, c)
    try {
      const res = await fetch(`/api/reports?startDate=${startDate}&endDate=${endDate}`)
      setData(await res.json())
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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <GlitchText text={t.reports.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />

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
      ) : data && (
        <>
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
            {/* Cash flow line */}
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
        </>
      )}
    </div>
  )
}
