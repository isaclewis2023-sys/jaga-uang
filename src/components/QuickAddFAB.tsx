'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, formatDate, getToday } from '@/lib/utils'
import type { Account, Category, Transaction } from '@/types'

function useDuplicateCheck(amount: string, description: string, date: string) {
  const [duplicates, setDuplicates] = useState<Transaction[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const num = Number(amount)
    if (!num || description.length < 3 || !date) { setDuplicates([]); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/transactions/check-duplicate?amount=${num}&description=${encodeURIComponent(description)}&date=${date}`)
        const data = await res.json()
        setDuplicates(Array.isArray(data) ? data : [])
      } catch { setDuplicates([]) }
    }, 500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [amount, description, date])

  return duplicates
}

export default function QuickAddFAB() {
  const { t, lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    accountId: '',
    categoryId: '',
    amount: '',
    description: '',
    date: getToday(),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const duplicates = useDuplicateCheck(form.amount, form.description, form.date)

  const loadMeta = useCallback(async () => {
    const [accRes, catRes] = await Promise.all([fetch('/api/accounts'), fetch('/api/categories')])
    const [accs, cats] = await Promise.all([accRes.json(), catRes.json()])
    const activeAccs = Array.isArray(accs) ? accs.filter((a: Account) => a.isActive) : []
    setAccounts(activeAccs)
    setCategories(Array.isArray(cats) ? cats : [])
    setForm((f) => ({ ...f, accountId: activeAccs[0]?.id ?? '' }))
  }, [])

  useEffect(() => { if (open) loadMeta() }, [open, loadMeta])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const handleOpen = () => {
    setForm({ type: 'expense', accountId: accounts[0]?.id ?? '', categoryId: '', amount: '', description: '', date: getToday() })
    setError('')
    setOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.accountId || !form.categoryId || !form.amount || !form.description) {
      setError(t.transactions.requiredFields)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      if (!res.ok) throw new Error()
      setOpen(false)
      window.dispatchEvent(new Event('transaction:added'))
      setToast(true)
      setTimeout(() => setToast(false), 2800)
    } catch {
      setError(t.transactions.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <motion.button
        onClick={handleOpen}
        aria-label={t.transactions.addTransaction}
        className="fixed bottom-24 right-5 md:bottom-8 md:right-7 z-40 w-12 h-12 rounded-full matrix-btn-solid flex items-center justify-center shadow-lg"
        style={{ background: 'rgba(0,255,65,0.15)', border: '1px solid rgba(0,255,65,0.5)', boxShadow: '0 0 18px rgba(0,255,65,0.25)' }}
        whileTap={{ scale: 0.92 }}
        whileHover={{ boxShadow: '0 0 28px rgba(0,255,65,0.4)' }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {open ? <X size={18} className="text-[#00ff41]" /> : <Plus size={20} className="text-[#00ff41]" />}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />

            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="fixed bottom-40 right-4 md:bottom-24 md:right-7 z-40 w-[min(360px,calc(100vw-2rem))] matrix-panel rounded-xl border border-[rgba(0,255,65,0.25)] shadow-2xl"
              style={{ boxShadow: '0 0 40px rgba(0,255,65,0.12), 0 8px 32px rgba(0,0,0,0.6)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,255,65,0.1)]">
                <span className="font-mono text-xs font-bold text-[#00ff41] tracking-widest uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  &gt; {t.transactions.addTransaction}
                </span>
                <button onClick={() => setOpen(false)} className="text-[#3a5c3a] hover:text-[#00b347] transition-colors">
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-4 space-y-3">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(['income', 'expense'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type, categoryId: '' }))}
                      className={`flex-1 py-1.5 font-mono text-xs font-semibold tracking-wider uppercase rounded border transition-all ${
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

                {/* Amount + Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="matrix-label">{t.transactions.amount}</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      className="matrix-input"
                      placeholder="0"
                      min="0"
                      step="1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="matrix-label">{t.transactions.date}</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="matrix-input text-xs"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="matrix-label">{t.transactions.description}</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="matrix-input"
                    placeholder={t.transactions.description}
                  />
                </div>

                {/* Duplicate warning */}
                <AnimatePresence>
                  {duplicates.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 p-2 rounded border border-[rgba(255,215,0,0.3)] bg-[rgba(255,215,0,0.05)] overflow-hidden"
                    >
                      <AlertTriangle size={12} className="text-[#ffd700] mt-0.5 shrink-0" />
                      <p className="font-mono text-[0.65rem] text-[#b8a000]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {t.transactions.duplicateWarning}: {duplicates[0].description} — {formatDate(duplicates[0].date, 'dd MMM', lang)} — {formatIDR(duplicates[0].amount)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Account + Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="matrix-label">{t.transactions.account}</label>
                    <select
                      value={form.accountId}
                      onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                      className="matrix-input text-xs"
                    >
                      <option value="">—</option>
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
                      className="matrix-input text-xs"
                    >
                      <option value="">—</option>
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <p className="text-[#ff2055] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt; {error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full matrix-btn matrix-btn-solid py-2"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? '> MENYIMPAN...' : `> ${t.common.add}`}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="fixed bottom-24 left-4 md:bottom-8 md:left-6 z-50 flex items-center gap-2 px-3 py-2 rounded border border-[rgba(0,255,65,0.35)] matrix-panel"
            style={{ boxShadow: '0 0 16px rgba(0,255,65,0.15)' }}
          >
            <span className="text-[#00ff41] text-sm">✓</span>
            <span className="font-mono text-xs text-[#00b347]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {t.transactions.added}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
