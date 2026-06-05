'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, Edit2, Download, ChevronDown, AlertTriangle } from 'lucide-react'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import TerminalModal from '@/components/matrix/TerminalModal'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, formatDate, getToday, getMonthStart, getMonthEnd } from '@/lib/utils'
import type { Transaction, Account, Category } from '@/types'

// ─── Date range helpers ───────────────────────────────────────────────────────

type DatePreset = 'today' | '7d' | 'month' | 'lastmonth' | 'custom'

function getPresetDates(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  switch (preset) {
    case 'today': {
      const t = getToday()
      return { start: t, end: t }
    }
    case '7d': {
      const end = getToday()
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { start, end }
    }
    case 'month':
      return { start: getMonthStart(y, m), end: getMonthEnd(y, m) }
    case 'lastmonth': {
      const lm = m === 1 ? 12 : m - 1
      const ly = m === 1 ? y - 1 : y
      return { start: getMonthStart(ly, lm), end: getMonthEnd(ly, lm) }
    }
    default:
      return { start: getMonthStart(y, m), end: getMonthEnd(y, m) }
  }
}

// ─── Duplicate warning hook ───────────────────────────────────────────────────

function useDuplicateCheck(amount: string, description: string, date: string, excludeId?: string) {
  const [duplicates, setDuplicates] = useState<Transaction[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const num = Number(amount)
    if (!num || description.length < 3 || !date) {
      setDuplicates([])
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ amount: String(num), description, date })
        if (excludeId) params.set('excludeId', excludeId)
        const res = await fetch(`/api/transactions/check-duplicate?${params}`)
        const data = await res.json()
        setDuplicates(Array.isArray(data) ? data : [])
      } catch {
        setDuplicates([])
      }
    }, 500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [amount, description, date, excludeId])

  return duplicates
}

// ─── Transaction Form ─────────────────────────────────────────────────────────

function TransactionForm({
  initial, accounts, categories, onSave, onClose,
}: {
  initial?: Transaction | null
  accounts: Account[]
  categories: Category[]
  onSave: (data: Partial<Transaction>) => Promise<void>
  onClose: () => void
}) {
  const { t, lang } = useLanguage()
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

  const duplicates = useDuplicateCheck(form.amount, form.description, form.date, initial?.id)
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
      await onSave({ ...form, amount: Number(form.amount) })
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

      {/* Duplicate warning */}
      <AnimatePresence>
        {duplicates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 p-2 rounded border border-[rgba(255,215,0,0.3)] bg-[rgba(255,215,0,0.05)]"
          >
            <AlertTriangle size={13} className="text-[#ffd700] mt-0.5 shrink-0" />
            <div>
              <p className="font-mono text-xs text-[#ffd700]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {t.transactions.duplicateWarning}:
              </p>
              {duplicates.map((d) => (
                <p key={d.id} className="font-mono text-[0.65rem] text-[#b8a000] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  · {d.description} — {formatDate(d.date, 'dd MMM yyyy', lang)} — {formatIDR(d.amount)}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {error && (
        <p className="text-[#ff2055] font-mono text-xs text-glow-red" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          &gt; {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="matrix-btn flex-1">{t.common.cancel}</button>
        <button type="submit" disabled={saving} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: saving ? 0.5 : 1 }}>
          {saving ? '> MENYIMPAN...' : initial ? `> ${t.common.save}` : `> ${t.common.add}`}
        </button>
      </div>
    </form>
  )
}

// ─── Export Dropdown ──────────────────────────────────────────────────────────

function ExportDropdown({ startDate, endDate, type }: { startDate: string; endDate: string; type: string }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buildUrl = (format: string) => {
    const p = new URLSearchParams({ format })
    if (startDate) p.set('startDate', startDate)
    if (endDate) p.set('endDate', endDate)
    if (type !== 'all') p.set('type', type)
    return `/api/export/csv?${p}`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="matrix-btn matrix-btn-sm flex items-center gap-1"
      >
        <Download size={12} />
        {t.transactions.export}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 matrix-panel border border-[rgba(0,255,65,0.2)] rounded min-w-[150px] py-1"
          >
            {[
              { label: t.transactions.exportCSV, fmt: 'csv' },
              { label: t.transactions.exportExcel, fmt: 'xlsx' },
            ].map(({ label, fmt }) => (
              <a
                key={fmt}
                href={buildUrl(fmt)}
                download
                onClick={() => setOpen(false)}
                className="block px-3 py-2 font-mono text-xs text-[#c8ffc8] hover:bg-[rgba(0,255,65,0.08)] hover:text-[#00ff41] transition-colors"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { t, lang } = useLanguage()
  const [txList, setTxList] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [preset, setPreset] = useState<DatePreset>('month')
  const [customRange, setCustomRange] = useState({ start: getMonthStart(), end: getMonthEnd() })
  const [showCustom, setShowCustom] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dateRange = preset === 'custom' ? customRange : getPresetDates(preset)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (dateRange.start) params.set('startDate', dateRange.start)
    if (dateRange.end) params.set('endDate', dateRange.end)
    if (filterType !== 'all') params.set('type', filterType)

    const [txRes, accRes, catRes] = await Promise.all([
      fetch(`/api/transactions?${params}`),
      fetch('/api/accounts'),
      fetch('/api/categories'),
    ])
    const [txs, accs, cats] = await Promise.all([txRes.json(), accRes.json(), catRes.json()])
    setTxList(Array.isArray(txs) ? txs : [])
    setAccounts(Array.isArray(accs) ? accs : [])
    setCategories(Array.isArray(cats) ? cats : [])
    setLoading(false)
  }, [dateRange.start, dateRange.end, filterType])

  useEffect(() => { load() }, [load])

  // Listen for quick-add FAB events
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('transaction:added', handler)
    return () => window.removeEventListener('transaction:added', handler)
  }, [load])

  const filtered = txList.filter((tx) => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const summaryIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const summaryExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const summaryNet = summaryIncome - summaryExpense

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
      window.dispatchEvent(new Event('transaction:added'))
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

  const presets: Array<{ key: DatePreset; label: string }> = [
    { key: 'today', label: t.transactions.today },
    { key: '7d', label: t.transactions.last7Days },
    { key: 'month', label: t.transactions.thisMonth },
    { key: 'lastmonth', label: t.transactions.lastMonth },
    { key: 'custom', label: t.transactions.customRange },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <GlitchText
          text={t.transactions.title}
          tag="h1"
          className="text-xl font-bold font-mono tracking-wider"
          style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties}
        />
        <div className="flex items-center gap-2">
          <ExportDropdown startDate={dateRange.start} endDate={dateRange.end} type={filterType} />
          <motion.button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="matrix-btn matrix-btn-solid"
            whileTap={{ scale: 0.97 }}
          >
            <Plus size={13} /> {t.transactions.addTransaction}
          </motion.button>
        </div>
      </div>

      {/* Date range filter */}
      <NeonCard className="p-3 space-y-2" animate={false}>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setPreset(key)
                setShowCustom(key === 'custom')
              }}
              className={`matrix-btn matrix-btn-sm ${preset === key ? 'matrix-btn-solid' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 items-center overflow-hidden"
            >
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange((c) => ({ ...c, start: e.target.value }))}
                className="matrix-input text-xs"
                style={{ width: 140, colorScheme: 'dark' }}
              />
              <span className="text-[#3a5c3a] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>—</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((c) => ({ ...c, end: e.target.value }))}
                className="matrix-input text-xs"
                style={{ width: 140, colorScheme: 'dark' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </NeonCard>

      {/* Search + type filter */}
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

      {/* Summary bar */}
      {!loading && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2"
        >
          {[
            { label: t.transactions.income, value: summaryIncome, color: '#00ff41' },
            { label: t.transactions.expense, value: summaryExpense, color: '#ff2055' },
            { label: 'Net', value: summaryNet, color: summaryNet >= 0 ? '#00ff41' : '#ff2055' },
          ].map(({ label, value, color }) => (
            <NeonCard key={label} className="p-2.5 text-center" animate={false}>
              <p className="matrix-label text-[0.55rem] mb-1">{label}</p>
              <p className="font-mono font-bold text-xs" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                {value >= 0 ? '' : '-'}{formatIDR(Math.abs(value), true)}
              </p>
            </NeonCard>
          ))}
        </motion.div>
      )}

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
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
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
            <p className="text-[#3a5c3a] font-mono text-[0.6rem] mt-2 text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {filtered.length} transaksi
            </p>
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
