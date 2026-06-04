'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import TerminalModal from '@/components/matrix/TerminalModal'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, getProgressPercentage } from '@/lib/utils'
import type { Budget, Category } from '@/types'

export default function BudgetPage() {
  const { t } = useLanguage()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ categoryId: '', amount: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [bRes, cRes] = await Promise.all([
      fetch(`/api/budget?month=${month}&year=${year}`),
      fetch('/api/categories'),
    ])
    const [b, c] = await Promise.all([bRes.json(), cRes.json()])
    setBudgets(b)
    setCategories(c.filter((cat: Category) => cat.type === 'expense'))
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: form.categoryId, amount: Number(form.amount), month, year }),
      })
      setShowModal(false)
      setForm({ categoryId: '', amount: '' })
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/budget/${id}`, { method: 'DELETE' })
    load()
  }

  const navMonth = (dir: number) => {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

  const usedCategoryIds = new Set(budgets.map((b) => b.categoryId))
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id))

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <GlitchText text={t.budget.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />
        <button onClick={() => setShowModal(true)} className="matrix-btn matrix-btn-solid matrix-btn-sm">
          <Plus size={12} /> {t.budget.addBudget}
        </button>
      </div>

      {/* Month nav */}
      <NeonCard className="p-3 flex items-center justify-between" animate={false}>
        <button onClick={() => navMonth(-1)} className="matrix-btn matrix-btn-icon matrix-btn-sm"><ChevronLeft size={14} /></button>
        <span className="font-mono font-semibold tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00ff41' }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={() => navMonth(1)} className="matrix-btn matrix-btn-icon matrix-btn-sm"><ChevronRight size={14} /></button>
      </NeonCard>

      {/* Summary */}
      {budgets.length > 0 && (
        <NeonCard className="p-4" animate={false}>
          <div className="flex justify-between mb-2">
            <span className="matrix-label">TOTAL ANGGARAN</span>
            <span className="font-mono text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', color: totalSpent > totalBudget ? '#ff2055' : '#00ff41' }}>
              {formatIDR(totalSpent)} / {formatIDR(totalBudget)}
            </span>
          </div>
          <div className="matrix-progress h-2">
            <motion.div
              className="matrix-progress-bar"
              style={{
                background: totalSpent >= totalBudget ? '#ff2055' : totalSpent >= totalBudget * 0.75 ? '#ffd700' : '#00ff41',
                width: `${Math.min(getProgressPercentage(totalSpent, totalBudget), 100)}%`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(getProgressPercentage(totalSpent, totalBudget), 100)}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </NeonCard>
      )}

      {loading ? (
        <div className="text-center py-10"><span className="font-mono text-[#00b347] cursor-blink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; MEMUAT</span></div>
      ) : budgets.length === 0 ? (
        <NeonCard className="p-8 text-center">
          <p className="text-[#3a5c3a] font-mono mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.budget.noBudgets}</p>
          <button onClick={() => setShowModal(true)} className="matrix-btn matrix-btn-solid"><Plus size={13} /> {t.budget.addBudget}</button>
        </NeonCard>
      ) : (
        <div className="space-y-3">
          {budgets.map((b, i) => {
            const pct = getProgressPercentage(b.spent ?? 0, b.amount)
            const remaining = b.amount - (b.spent ?? 0)
            const barColor = pct >= 100 ? '#ff2055' : pct >= 75 ? '#ffd700' : '#00ff41'
            const statusLabel = pct >= 100 ? t.budget.exceeded : pct >= 75 ? t.budget.warning : t.budget.onTrack

            return (
              <NeonCard key={b.id} className="p-4" delay={i * 0.05}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{b.category?.icon}</span>
                    <div>
                      <p className="font-mono font-semibold text-sm text-[#c8ffc8]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{b.category?.name}</p>
                      <span className="matrix-badge" style={{ background: `${barColor}15`, color: barColor, border: `1px solid ${barColor}30` }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="matrix-btn matrix-btn-icon matrix-btn-sm matrix-btn-danger opacity-50 hover:opacity-100">
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="matrix-progress h-2 mb-2">
                  <motion.div
                    className="matrix-progress-bar"
                    style={{ background: barColor, width: `${Math.min(pct, 100)}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.7, delay: i * 0.05 }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  <span className="text-[#3a5c3a]">{t.budget.spent}: <span style={{ color: barColor }}>{formatIDR(b.spent ?? 0)}</span></span>
                  <span className="text-[#3a5c3a]">{t.budget.limit}: <span className="text-[#c8ffc8]">{formatIDR(b.amount)}</span></span>
                  <span className="text-[#3a5c3a]">{t.budget.remaining}: <span style={{ color: remaining >= 0 ? '#00b347' : '#ff2055' }}>{formatIDR(Math.abs(remaining))}</span></span>
                </div>
              </NeonCard>
            )
          })}
        </div>
      )}

      <TerminalModal open={showModal} onClose={() => setShowModal(false)} title={t.budget.addBudget}>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="matrix-label">{t.budget.category}</label>
            <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className="matrix-input" required>
              <option value="">Pilih kategori</option>
              {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="matrix-label">{t.budget.limit} (IDR)</label>
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="matrix-input" min="1000" step="10000" required />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowModal(false)} className="matrix-btn flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={saving} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: saving ? 0.5 : 1 }}>
              {saving ? '> MENYIMPAN...' : `> ${t.common.save}`}
            </button>
          </div>
        </form>
      </TerminalModal>
    </div>
  )
}
