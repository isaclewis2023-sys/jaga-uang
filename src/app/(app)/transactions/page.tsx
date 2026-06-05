'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Filter, Trash2, Edit2, X, ChevronDown } from 'lucide-react'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import TerminalModal from '@/components/matrix/TerminalModal'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, formatDate, getToday } from '@/lib/utils'
import type { Transaction, Account, Category } from '@/types'

const ICONS_INCOME = ['💼', '💻', '📈', '🎁', '💰', '🏆', '🌟']
const ICONS_EXPENSE = ['🍽️', '🚗', '🛒', '🔌', '🏥', '🎮', '📚', '📱', '✈️', '💄', '🏋️']

function TransactionForm({
  initial, accounts, categories, onSave, onClose
}: {
  initial?: Transaction | null
  accounts: Account[]
  categories: Category[]
  onSave: (data: Partial<Transaction>) => Promise<void>
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    type: initial?.type ?? 'expense' as 'income' | 'expense',
    accountId: initial?.accountId ?? (accounts[0]?.id ?? ''),
    categoryId: initial?.categoryId ?? '',
    amount: initial?.amount ? String(initial.amount) : '',
    description: initial?.description ?? '',
    date: initial?.date ?? getToday(),
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.accountId || !form.categoryId || !form.amount || !form.description || !form.date) {
      setError(t.transactions.requiredFields)
      return
    }
    setSaving(true)
    try {
      await onSave({ ...form, amount: Number(form.amount.replace(/\./g, '').replace(',', '.')) })
    } catch {
      setError(t.transactions.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(['income', 'expense'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setForm((f) => ({ ...f, type, categoryId: '' }))}
            className={`flex-1 py-2 font-mono text-xs font-semibold tracking-wider uppercase rounded border transition-all ${
              form.type === type
                ? type === 'income'
                  ? 'border-[#00ff41] bg-[rgba(0,255,65,0.1)] text-[#00ff41]'
                  : 'border-[#ff2055] bg-[rgba(255,32,85,0.1)] text-[#ff2055]'
                : 'border-[rgba(0,255,65,0.1)] text-[#3a5c3a] hover:border-[rgba(0,255,65,0.3)]'
            }`}
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {type === 'income' ? `▲ ${t.transactions.income}` : `▼ ${t.transactions.expense}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="matrix-label">{t.transactions.amount} (IDR)</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="matrix-input"
            placeholder="0"
            min="0"
            step="1"
            required
          />
        </div>
        <div>
          <label className="matrix-label">{t.transactions.date}</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="matrix-input"
            style={{ colorScheme: 'dark' }}
            required
          />
        </div>
      </div>

      <div>
        <label className="matrix-label">{t.transactions.description}</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="matrix-input"
          placeholder={t.transactions.description}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="matrix-label">{t.transactions.account}</label>
          <select
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            className="matrix-input"
            required
          >
            <option value="">Pilih akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="matrix-label">{t.transactions.category}</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            className="matrix-input"
            required
          >
            <option value="">Pilih kategori</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="matrix-label">{t.transactions.notes} ({t.common.optional})</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="matrix-input resize-none"
          rows={2}
          placeholder="Catatan tambahan..."
        />
      </div>

      {error && <p className="text-[#ff2055] font-mono text-xs text-glow-red" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; {error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="matrix-btn flex-1">{t.common.cancel}</button>
        <button type="submit" disabled={saving} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: saving ? 0.5 : 1 }}>
          {saving ? '> MENYIMPAN...' : initial ? `> ${t.common.save}` : `> ${t.common.add}`}
        </button>
      </div>
    </form>
  )
}

export default function TransactionsPage() {
  const { t, lang } = useLanguage()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PER_PAGE = 20

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, accRes, catRes] = await Promise.all([
      fetch(`/api/transactions?limit=200&offset=${page * PER_PAGE}`),
      fetch('/api/accounts'),
      fetch('/api/categories'),
    ])
    const [txs, accs, cats] = await Promise.all([txRes.json(), accRes.json(), catRes.json()])
    setTransactions(txs)
    setAccounts(accs)
    setCategories(cats)
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleSave = async (data: Partial<Transaction>) => {
    if (editing) {
      await fetch(`/api/transactions/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    setShowModal(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <GlitchText text={t.transactions.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />
        <motion.button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="matrix-btn matrix-btn-solid"
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={13} /> {t.transactions.addTransaction}
        </motion.button>
      </div>

      {/* Filters */}
      <NeonCard className="p-3 flex flex-wrap items-center gap-3" animate={false}>
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3a5c3a]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="matrix-input pl-8"
            placeholder={t.common.search + '...'}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`matrix-btn matrix-btn-sm ${filterType === f ? 'matrix-btn-solid' : ''}`}
            >
              {f === 'all' ? t.common.all : f === 'income' ? t.transactions.income : t.transactions.expense}
            </button>
          ))}
        </div>
      </NeonCard>

      {/* Table */}
      <NeonCard className="p-4" animate={false}>
        {loading ? (
          <div className="text-center py-8">
            <span className="font-mono text-[#00b347] text-sm cursor-blink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; MEMUAT</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[#3a5c3a] font-mono text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.transactions.noTransactions}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>{t.transactions.date}</th>
                  <th>{t.transactions.description}</th>
                  <th className="hidden sm:table-cell">{t.transactions.category}</th>
                  <th className="hidden md:table-cell">{t.transactions.account}</th>
                  <th className="text-right">{t.transactions.amount}</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((tx, i) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="text-[#3a5c3a] font-mono text-xs whitespace-nowrap" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {formatDate(tx.date, 'dd MMM yy', lang)}
                      </td>
                      <td className="font-mono text-sm text-[#c8ffc8] max-w-[160px] truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {tx.description}
                        {tx.isRecurring && <span className="ml-1 text-[#00e5ff] text-[0.6rem]">↻</span>}
                      </td>
                      <td className="hidden sm:table-cell">
                        {tx.category && (
                          <span className="matrix-badge" style={{ background: `${tx.category.color}15`, color: tx.category.color, border: `1px solid ${tx.category.color}28` }}>
                            {tx.category.icon} {tx.category.name}
                          </span>
                        )}
                      </td>
                      <td className="hidden md:table-cell text-[#3a5c3a] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {tx.account?.icon} {tx.account?.name}
                      </td>
                      <td className="text-right font-mono font-semibold text-sm whitespace-nowrap" style={{ fontFamily: 'JetBrains Mono, monospace', color: tx.type === 'income' ? '#00ff41' : '#ff2055' }}>
                        {tx.type === 'income' ? '+' : '-'}{formatIDR(tx.amount)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditing(tx); setShowModal(true) }}
                            className="matrix-btn matrix-btn-icon matrix-btn-sm opacity-50 hover:opacity-100"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => setDeletingId(tx.id)}
                            className="matrix-btn matrix-btn-icon matrix-btn-sm matrix-btn-danger opacity-50 hover:opacity-100"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </NeonCard>

      {/* Add/Edit Modal */}
      <TerminalModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? t.transactions.editTransaction : t.transactions.addTransaction}
      >
        <TransactionForm
          initial={editing}
          accounts={accounts}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      </TerminalModal>

      {/* Delete confirm */}
      <TerminalModal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title={t.transactions.deleteTransaction}
        maxWidth="max-w-sm"
      >
        <p className="font-mono text-sm text-[#c8ffc8] mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {t.transactions.deleteConfirm}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setDeletingId(null)} className="matrix-btn flex-1">{t.common.cancel}</button>
          <button onClick={() => deletingId && handleDelete(deletingId)} className="matrix-btn matrix-btn-danger flex-1">{t.common.delete}</button>
        </div>
      </TerminalModal>
    </div>
  )
}
