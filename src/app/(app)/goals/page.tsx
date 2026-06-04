'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit2, PlusCircle } from 'lucide-react'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import TerminalModal from '@/components/matrix/TerminalModal'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, getProgressPercentage, getDaysRemaining } from '@/lib/utils'
import type { Goal } from '@/types'

const GOAL_ICONS = ['🎯', '🏠', '🚗', '✈️', '💍', '📱', '💻', '📚', '🎓', '💰', '🏋️', '🌍']
const COLORS = ['#00ff41', '#00e5ff', '#ffd700', '#ff6b6b', '#a29bfe', '#fd79a8', '#00b347', '#ff9f43']

function GoalProgressRing({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const pct = Math.min(getProgressPercentage(value, max), 100)
  const dash = (pct / 100) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id={`glow-${color.replace('#', '')}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,255,65,0.08)" strokeWidth="6" />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        filter={`url(#glow-${color.replace('#', '')})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ}` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize={size * 0.2} fontWeight="700" fontFamily="JetBrains Mono, monospace">
        {pct}%
      </text>
    </svg>
  )
}

function GoalForm({ initial, onSave, onClose, t }: {
  initial?: Goal | null
  onSave: (data: Partial<Goal>) => Promise<void>
  onClose: () => void
  t: ReturnType<typeof useLanguage>['t']
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    targetAmount: initial?.targetAmount ? String(initial.targetAmount) : '',
    currentAmount: initial?.currentAmount ? String(initial.currentAmount) : '0',
    deadline: initial?.deadline ?? '',
    color: initial?.color ?? '#00ff41',
    icon: initial?.icon ?? '🎯',
    description: initial?.description ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, targetAmount: Number(form.targetAmount), currentAmount: Number(form.currentAmount) })
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="w-14">
          <label className="matrix-label">Ikon</label>
          <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="matrix-input text-center text-xl" maxLength={2} />
        </div>
        <div className="flex-1">
          <label className="matrix-label">{t.goals.name}</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="matrix-input" placeholder="Beli Rumah" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="matrix-label">{t.goals.target} (IDR)</label>
          <input type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} className="matrix-input" min="1" required />
        </div>
        <div>
          <label className="matrix-label">{t.goals.current} (IDR)</label>
          <input type="number" value={form.currentAmount} onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))} className="matrix-input" min="0" />
        </div>
      </div>
      <div>
        <label className="matrix-label">{t.goals.deadline} ({t.common.optional})</label>
        <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="matrix-input" style={{ colorScheme: 'dark' }} />
      </div>
      <div>
        <label className="matrix-label">{t.goals.description} ({t.common.optional})</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="matrix-input resize-none" rows={2} />
      </div>
      <div>
        <label className="matrix-label">Warna</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
              className="w-7 h-7 rounded transition-transform hover:scale-110"
              style={{ background: c, border: form.color === c ? '2px solid #fff' : '2px solid transparent', boxShadow: form.color === c ? `0 0 8px ${c}` : 'none' }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="matrix-btn flex-1">{t.common.cancel}</button>
        <button type="submit" disabled={saving} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: saving ? 0.5 : 1 }}>
          {saving ? '> MENYIMPAN...' : `> ${t.common.save}`}
        </button>
      </div>
    </form>
  )
}

export default function GoalsPage() {
  const { t } = useLanguage()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null)
  const [fundsAmount, setFundsAmount] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/goals')
    setGoals(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Goal>) => {
    if (editing) {
      await fetch(`/api/goals/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    } else {
      await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    }
    setShowModal(false); setEditing(null); load()
  }

  const handleAddFunds = async () => {
    if (!addFundsGoal || !fundsAmount) return
    await fetch(`/api/goals/${addFundsGoal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addFunds: Number(fundsAmount) }),
    })
    setAddFundsGoal(null); setFundsAmount(''); load()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setDeletingId(null); load()
  }

  const active = goals.filter((g) => !g.isCompleted)
  const achieved = goals.filter((g) => g.isCompleted)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <GlitchText text={t.goals.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />
        <button onClick={() => { setEditing(null); setShowModal(true) }} className="matrix-btn matrix-btn-solid matrix-btn-sm">
          <Plus size={12} /> {t.goals.addGoal}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10"><span className="font-mono text-[#00b347] cursor-blink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; MEMUAT</span></div>
      ) : goals.length === 0 ? (
        <NeonCard className="p-8 text-center">
          <p className="text-[#3a5c3a] font-mono mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.goals.noGoals}</p>
          <button onClick={() => setShowModal(true)} className="matrix-btn matrix-btn-solid"><Plus size={13} /> {t.goals.addGoal}</button>
        </NeonCard>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="matrix-label mb-3">{t.goals.inProgress} ({active.length})</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {active.map((goal, i) => {
                  const daysLeft = goal.deadline ? getDaysRemaining(goal.deadline) : null
                  const remaining = goal.targetAmount - goal.currentAmount
                  const monthlyNeeded = daysLeft && daysLeft > 0 ? Math.ceil(remaining / (daysLeft / 30)) : null

                  return (
                    <NeonCard key={goal.id} className="p-4" delay={i * 0.07}>
                      <div className="flex items-start gap-4">
                        <GoalProgressRing value={goal.currentAmount} max={goal.targetAmount} color={goal.color} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-mono font-semibold text-sm text-[#c8ffc8]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                                {goal.icon} {goal.name}
                              </p>
                              {goal.description && (
                                <p className="text-[#3a5c3a] font-mono text-xs mt-0.5 truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{goal.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => { setEditing(goal); setShowModal(true) }} className="matrix-btn matrix-btn-icon matrix-btn-sm opacity-50 hover:opacity-100"><Edit2 size={10} /></button>
                              <button onClick={() => setDeletingId(goal.id)} className="matrix-btn matrix-btn-icon matrix-btn-sm matrix-btn-danger opacity-50 hover:opacity-100"><Trash2 size={10} /></button>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              <span className="text-[#3a5c3a]">{formatIDR(goal.currentAmount, true)}</span>
                              <span style={{ color: goal.color }}>{formatIDR(goal.targetAmount, true)}</span>
                            </div>
                            <div className="flex gap-2 text-xs font-mono mt-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              {daysLeft !== null && (
                                <span className={`matrix-badge ${daysLeft < 0 ? 'text-[#ff2055]' : 'text-[#ffd700]'}`} style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                                  {daysLeft < 0 ? t.goals.overdue.toUpperCase() : `${daysLeft} ${t.goals.daysLeft}`}
                                </span>
                              )}
                              {monthlyNeeded && (
                                <span className="text-[#3a5c3a]">{formatIDR(monthlyNeeded, true)}/bln</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setAddFundsGoal(goal)}
                            className="matrix-btn matrix-btn-sm matrix-btn-solid mt-2 w-full"
                          >
                            <PlusCircle size={11} /> {t.goals.addFunds}
                          </button>
                        </div>
                      </div>
                    </NeonCard>
                  )
                })}
              </div>
            </div>
          )}

          {achieved.length > 0 && (
            <div>
              <p className="matrix-label mb-3 text-[#00ff41]">{t.goals.achieved} ({achieved.length})</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {achieved.map((goal, i) => (
                  <NeonCard key={goal.id} className="p-4 opacity-70" delay={i * 0.05}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{goal.icon}</span>
                      <div>
                        <p className="font-mono font-semibold text-sm text-[#00ff41] text-glow" style={{ fontFamily: 'JetBrains Mono, monospace' }}>✓ {goal.name}</p>
                        <p className="font-mono text-xs text-[#00b347]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatIDR(goal.targetAmount)}</p>
                      </div>
                    </div>
                  </NeonCard>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <TerminalModal open={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? t.goals.editGoal : t.goals.addGoal}>
        <GoalForm initial={editing} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null) }} t={t} />
      </TerminalModal>

      <TerminalModal open={!!addFundsGoal} onClose={() => setAddFundsGoal(null)} title={`${t.goals.addFunds}: ${addFundsGoal?.icon} ${addFundsGoal?.name}`} maxWidth="max-w-sm">
        <div className="space-y-3">
          <div>
            <label className="matrix-label">{t.transactions.amount} (IDR)</label>
            <input type="number" value={fundsAmount} onChange={(e) => setFundsAmount(e.target.value)} className="matrix-input" placeholder="0" min="1000" step="10000" autoFocus />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAddFundsGoal(null)} className="matrix-btn flex-1">{t.common.cancel}</button>
            <button onClick={handleAddFunds} disabled={!fundsAmount} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: !fundsAmount ? 0.5 : 1 }}>
              &gt; {t.goals.addFunds}
            </button>
          </div>
        </div>
      </TerminalModal>

      <TerminalModal open={!!deletingId} onClose={() => setDeletingId(null)} title={t.goals.deleteGoal} maxWidth="max-w-sm">
        <p className="font-mono text-sm text-[#c8ffc8] mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Yakin ingin menghapus tujuan ini?</p>
        <div className="flex gap-2">
          <button onClick={() => setDeletingId(null)} className="matrix-btn flex-1">{t.common.cancel}</button>
          <button onClick={() => deletingId && handleDelete(deletingId)} className="matrix-btn matrix-btn-danger flex-1">{t.common.delete}</button>
        </div>
      </TerminalModal>
    </div>
  )
}
