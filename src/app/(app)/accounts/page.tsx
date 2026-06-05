'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, ArrowLeftRight } from 'lucide-react'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import TerminalModal from '@/components/matrix/TerminalModal'
import CounterNumber from '@/components/matrix/CounterNumber'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR } from '@/lib/utils'
import type { Account } from '@/types'

const ACCOUNT_TYPES = ['bank', 'cash', 'savings', 'investment', 'credit'] as const
const TYPE_ICONS: Record<string, string> = { bank: '🏦', cash: '💵', savings: '🏧', investment: '📈', credit: '💳' }
const COLORS = ['#00ff41', '#00e5ff', '#ffd700', '#ff6b6b', '#a29bfe', '#fd79a8', '#00b347', '#ff9f43']

function AccountForm({ initial, onSave, onClose, t }: {
  initial?: Account | null
  onSave: (data: Partial<Account>) => Promise<void>
  onClose: () => void
  t: ReturnType<typeof useLanguage>['t']
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'bank' as Account['type'],
    balance: initial?.balance ? String(initial.balance) : '0',
    color: initial?.color ?? '#00ff41',
    icon: initial?.icon ?? TYPE_ICONS[initial?.type ?? 'bank'],
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, balance: Number(form.balance) })
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="matrix-label">{t.accounts.name}</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="matrix-input" placeholder="BCA Utama" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="matrix-label">{t.accounts.type}</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Account['type'], icon: TYPE_ICONS[e.target.value] }))} className="matrix-input">
            {ACCOUNT_TYPES.map((tp) => (
              <option key={tp} value={tp}>{TYPE_ICONS[tp]} {t.accounts[tp]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="matrix-label">{t.accounts.balance} (IDR)</label>
          <input type="number" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} className="matrix-input" step="1" required />
        </div>
      </div>
      <div>
        <label className="matrix-label">Ikon</label>
        <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="matrix-input text-xl" placeholder="🏦" maxLength={2} />
      </div>
      <div>
        <label className="matrix-label">Warna</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
              className="w-7 h-7 rounded transition-transform hover:scale-110"
              style={{ background: c, border: form.color === c ? `2px solid #fff` : '2px solid transparent', boxShadow: form.color === c ? `0 0 8px ${c}` : 'none' }}
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

export default function AccountsPage() {
  const { t } = useLanguage()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transfer, setTransfer] = useState({ fromAccountId: '', toAccountId: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] })
  const [transferring, setTransferring] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accounts')
    setAccounts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Account>) => {
    if (editing) {
      await fetch(`/api/accounts/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    } else {
      await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    }
    setShowModal(false); setEditing(null); load()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    setDeletingId(null); load()
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferring(true)
    try {
      await fetch('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...transfer, amount: Number(transfer.amount) }) })
      setShowTransfer(false)
      setTransfer({ fromAccountId: '', toAccountId: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] })
      load()
    } finally { setTransferring(false) }
  }

  const totalAssets = accounts.filter((a) => a.type !== 'credit').reduce((s, a) => s + Math.max(0, a.balance), 0)
  const totalLiabilities = accounts.filter((a) => a.type === 'credit').reduce((s, a) => s + a.balance, 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <GlitchText text={t.accounts.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)} className="matrix-btn matrix-btn-sm">
            <ArrowLeftRight size={12} /> {t.accounts.transfer}
          </button>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="matrix-btn matrix-btn-solid matrix-btn-sm">
            <Plus size={12} /> {t.accounts.addAccount}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <NeonCard className="p-4 text-center">
          <p className="matrix-label mb-1">{t.accounts.totalAssets}</p>
          <div className="font-bold font-mono text-xl text-[#00ff41] text-glow" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <CounterNumber value={totalAssets} currency />
          </div>
        </NeonCard>
        <NeonCard className="p-4 text-center">
          <p className="matrix-label mb-1">{t.accounts.totalLiabilities}</p>
          <div className="font-bold font-mono text-xl text-[#ff2055] text-glow-red" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <CounterNumber value={totalLiabilities} currency />
          </div>
        </NeonCard>
      </div>

      {/* Accounts grid */}
      {loading ? (
        <div className="text-center py-10"><span className="font-mono text-[#00b347] cursor-blink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; MEMUAT</span></div>
      ) : accounts.length === 0 ? (
        <NeonCard className="p-8 text-center">
          <p className="text-[#3a5c3a] font-mono mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.accounts.noAccounts}</p>
          <button onClick={() => setShowModal(true)} className="matrix-btn matrix-btn-solid">
            <Plus size={13} /> {t.accounts.addAccount}
          </button>
        </NeonCard>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((acc, i) => (
            <NeonCard key={acc.id} className="p-4" delay={i * 0.06}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{acc.icon}</span>
                  <div>
                    <p className="font-mono font-semibold text-sm text-[#c8ffc8]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{acc.name}</p>
                    <span className="matrix-badge" style={{ background: `${acc.color}15`, color: acc.color, border: `1px solid ${acc.color}30` }}>
                      {t.accounts[acc.type]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(acc); setShowModal(true) }} className="matrix-btn matrix-btn-icon matrix-btn-sm opacity-50 hover:opacity-100"><Edit2 size={11} /></button>
                  <button onClick={() => setDeletingId(acc.id)} className="matrix-btn matrix-btn-icon matrix-btn-sm matrix-btn-danger opacity-50 hover:opacity-100"><Trash2 size={11} /></button>
                </div>
              </div>
              <div className={`font-mono font-bold text-xl ${acc.balance >= 0 ? 'text-glow' : 'text-glow-red'}`}
                style={{ fontFamily: 'JetBrains Mono, monospace', color: acc.balance >= 0 ? acc.color : '#ff2055' }}>
                {formatIDR(acc.balance)}
              </div>
            </NeonCard>
          ))}
        </div>
      )}

      {/* Account form modal */}
      <TerminalModal open={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? t.accounts.editAccount : t.accounts.addAccount}>
        <AccountForm initial={editing} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null) }} t={t} />
      </TerminalModal>

      {/* Transfer modal */}
      <TerminalModal open={showTransfer} onClose={() => setShowTransfer(false)} title={t.accounts.transferBetweenAccounts}>
        <form onSubmit={handleTransfer} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="matrix-label">{t.accounts.from}</label>
              <select value={transfer.fromAccountId} onChange={(e) => setTransfer((f) => ({ ...f, fromAccountId: e.target.value }))} className="matrix-input" required>
                <option value="">Pilih</option>
                {accounts.filter((a) => a.id !== transfer.toAccountId).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="matrix-label">{t.accounts.to}</label>
              <select value={transfer.toAccountId} onChange={(e) => setTransfer((f) => ({ ...f, toAccountId: e.target.value }))} className="matrix-input" required>
                <option value="">Pilih</option>
                {accounts.filter((a) => a.id !== transfer.fromAccountId).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="matrix-label">{t.transactions.amount}</label>
              <input type="number" value={transfer.amount} onChange={(e) => setTransfer((f) => ({ ...f, amount: e.target.value }))} className="matrix-input" required min="1" />
            </div>
            <div>
              <label className="matrix-label">{t.transactions.date}</label>
              <input type="date" value={transfer.date} onChange={(e) => setTransfer((f) => ({ ...f, date: e.target.value }))} className="matrix-input" style={{ colorScheme: 'dark' }} required />
            </div>
          </div>
          <div>
            <label className="matrix-label">{t.transactions.description}</label>
            <input value={transfer.description} onChange={(e) => setTransfer((f) => ({ ...f, description: e.target.value }))} className="matrix-input" placeholder="Transfer" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowTransfer(false)} className="matrix-btn flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={transferring} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: transferring ? 0.5 : 1 }}>
              {transferring ? '> MEMPROSES...' : `> ${t.accounts.transfer}`}
            </button>
          </div>
        </form>
      </TerminalModal>

      {/* Delete confirm */}
      <TerminalModal open={!!deletingId} onClose={() => setDeletingId(null)} title={t.accounts.deleteAccount} maxWidth="max-w-sm">
        <p className="font-mono text-sm text-[#c8ffc8] mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.accounts.deactivateConfirm}</p>
        <div className="flex gap-2">
          <button onClick={() => setDeletingId(null)} className="matrix-btn flex-1">{t.common.cancel}</button>
          <button onClick={() => deletingId && handleDelete(deletingId)} className="matrix-btn matrix-btn-danger flex-1">{t.common.delete}</button>
        </div>
      </TerminalModal>
    </div>
  )
}
