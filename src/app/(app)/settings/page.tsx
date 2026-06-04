'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit2, Download, Globe, ShieldCheck, RefreshCw } from 'lucide-react'
import NeonCard from '@/components/matrix/NeonCard'
import GlitchText from '@/components/matrix/GlitchText'
import TerminalModal from '@/components/matrix/TerminalModal'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate, formatIDR } from '@/lib/utils'
import type { Category, RecurringRule, Account } from '@/types'

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage()
  const [categories, setCategories] = useState<Category[]>([])
  const [recurring, setRecurring] = useState<RecurringRule[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'categories' | 'security' | 'recurring' | 'data'>('categories')

  // Category form
  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', color: '#ff6b6b', icon: '📂' })
  const [savingCat, setSavingCat] = useState(false)

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // Recurring form
  const [showRecModal, setShowRecModal] = useState(false)
  const [recForm, setRecForm] = useState({ accountId: '', categoryId: '', type: 'expense' as 'income' | 'expense', amount: '', description: '', frequency: 'monthly' as RecurringRule['frequency'], startDate: new Date().toISOString().split('T')[0] })
  const [savingRec, setSavingRec] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [catRes, recRes, accRes] = await Promise.all([
      fetch('/api/categories'), fetch('/api/recurring'), fetch('/api/accounts')
    ])
    const [cats, recs, accs] = await Promise.all([catRes.json(), recRes.json(), accRes.json()])
    setCategories(cats); setRecurring(recs); setAccounts(accs)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingCat(true)
    try {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
      setShowCatModal(false); setCatForm({ name: '', type: 'expense', color: '#ff6b6b', icon: '📂' }); load()
    } finally { setSavingCat(false) }
  }

  const handleDeleteCat = async (id: string) => {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' }); load()
  }

  const handleSavePw = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg('')
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg('Password baru tidak cocok'); return }
    if (pwForm.newPassword.length < 8) { setPwMsg('Password minimal 8 karakter'); return }
    setSavingPw(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change-password', currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      })
      const data = await res.json()
      if (res.ok) { setPwMsg('✓ Password berhasil diubah'); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }) }
      else setPwMsg(`✗ ${data.error}`)
    } finally { setSavingPw(false) }
  }

  const handleSaveRec = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingRec(true)
    try {
      await fetch('/api/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...recForm, amount: Number(recForm.amount) }) })
      setShowRecModal(false); setRecForm({ accountId: '', categoryId: '', type: 'expense', amount: '', description: '', frequency: 'monthly', startDate: new Date().toISOString().split('T')[0] }); load()
    } finally { setSavingRec(false) }
  }

  const handleDeleteRec = async (id: string) => {
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' }); load()
  }

  const handleToggleRec = async (id: string, isActive: boolean) => {
    await fetch(`/api/recurring/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }) }); load()
  }

  const tabs = [
    { key: 'categories', label: t.settings.categories },
    { key: 'security', label: t.settings.security },
    { key: 'recurring', label: t.settings.recurring },
    { key: 'data', label: t.settings.data },
  ] as const

  const filteredCats = { income: categories.filter((c) => c.type === 'income'), expense: categories.filter((c) => c.type === 'expense') }
  const FREQ_LABELS: Record<string, string> = { daily: t.settings.daily, weekly: t.settings.weekly, monthly: t.settings.monthly, yearly: t.settings.yearly }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <GlitchText text={t.settings.title} tag="h1" className="text-xl font-bold font-mono tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties} />

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
            className={`matrix-btn matrix-btn-sm ${activeTab === key ? 'matrix-btn-solid' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Language toggle */}
      <NeonCard className="p-3 flex items-center justify-between" animate={false}>
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-[#00b347]" />
          <span className="font-mono text-sm text-[#c8ffc8]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.settings.language}</span>
        </div>
        <div className="flex gap-1">
          {(['id', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`matrix-btn matrix-btn-sm ${lang === l ? 'matrix-btn-solid' : ''}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </NeonCard>

      {/* Categories tab */}
      {activeTab === 'categories' && (
        <NeonCard className="p-4" animate={false}>
          <div className="flex items-center justify-between mb-4">
            <p className="matrix-label">{t.settings.categories}</p>
            <button onClick={() => setShowCatModal(true)} className="matrix-btn matrix-btn-sm matrix-btn-solid"><Plus size={12} /> {t.settings.addCategory}</button>
          </div>
          {(['income', 'expense'] as const).map((type) => (
            <div key={type} className="mb-4">
              <p className="font-mono text-xs mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', color: type === 'income' ? '#00ff41' : '#ff2055' }}>
                {type === 'income' ? `▲ ${t.transactions.income}` : `▼ ${t.transactions.expense}`}
              </p>
              <div className="space-y-1">
                {filteredCats[type].map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[rgba(0,255,65,0.03)] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat.icon}</span>
                      <span className="font-mono text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', color: cat.color }}>{cat.name}</span>
                      {cat.isDefault && <span className="matrix-badge text-[#3a5c3a]" style={{ border: '1px solid rgba(58,92,58,0.3)' }}>DEFAULT</span>}
                    </div>
                    {!cat.isDefault && (
                      <button onClick={() => handleDeleteCat(cat.id)} className="matrix-btn matrix-btn-icon matrix-btn-sm matrix-btn-danger opacity-50 hover:opacity-100"><Trash2 size={11} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </NeonCard>
      )}

      {/* Security tab */}
      {activeTab === 'security' && (
        <NeonCard className="p-4" animate={false}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-[#00b347]" />
            <p className="matrix-label">{t.settings.changePassword}</p>
          </div>
          <form onSubmit={handleSavePw} className="space-y-3">
            <div>
              <label className="matrix-label">{t.settings.currentPassword}</label>
              <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} className="matrix-input" required />
            </div>
            <div>
              <label className="matrix-label">{t.settings.newPassword}</label>
              <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} className="matrix-input" required minLength={8} />
            </div>
            <div>
              <label className="matrix-label">{t.settings.confirmPassword}</label>
              <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))} className="matrix-input" required />
            </div>
            {pwMsg && (
              <p className={`font-mono text-xs ${pwMsg.startsWith('✓') ? 'text-[#00ff41]' : 'text-[#ff2055]'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {pwMsg}
              </p>
            )}
            <button type="submit" disabled={savingPw} className="matrix-btn matrix-btn-solid w-full" style={{ opacity: savingPw ? 0.5 : 1 }}>
              {savingPw ? '> MENYIMPAN...' : `> ${t.settings.changePassword}`}
            </button>
          </form>
        </NeonCard>
      )}

      {/* Recurring tab */}
      {activeTab === 'recurring' && (
        <NeonCard className="p-4" animate={false}>
          <div className="flex items-center justify-between mb-4">
            <p className="matrix-label">{t.settings.recurring}</p>
            <div className="flex gap-2">
              <button onClick={() => fetch('/api/recurring', { method: 'PUT' }).then(() => load())} className="matrix-btn matrix-btn-sm">
                <RefreshCw size={12} /> Proses
              </button>
              <button onClick={() => setShowRecModal(true)} className="matrix-btn matrix-btn-sm matrix-btn-solid"><Plus size={12} /> {t.settings.addRecurring}</button>
            </div>
          </div>
          {recurring.length === 0 ? (
            <p className="text-[#3a5c3a] font-mono text-sm text-center py-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Belum ada transaksi berulang</p>
          ) : (
            <div className="space-y-2">
              {recurring.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded border border-[rgba(0,255,65,0.06)] hover:border-[rgba(0,255,65,0.15)] transition-colors">
                  <div>
                    <p className="font-mono text-sm text-[#c8ffc8]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {r.category?.icon} {r.description}
                      <span className={`ml-2 matrix-badge ${r.type === 'income' ? 'text-[#00ff41]' : 'text-[#ff2055]'}`}
                        style={{ background: r.type === 'income' ? 'rgba(0,255,65,0.1)' : 'rgba(255,32,85,0.1)', border: `1px solid ${r.type === 'income' ? 'rgba(0,255,65,0.2)' : 'rgba(255,32,85,0.2)'}` }}>
                        {r.type === 'income' ? '+' : '-'}{formatIDR(r.amount, true)}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-[#3a5c3a] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {FREQ_LABELS[r.frequency]} · {t.settings.nextDue}: {r.nextDue} · {r.account?.name}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleToggleRec(r.id, r.isActive)}
                      className={`matrix-btn matrix-btn-sm ${r.isActive ? 'matrix-btn-solid' : ''}`}
                      style={{ fontSize: '0.65rem' }}>
                      {r.isActive ? t.settings.active : t.settings.inactive}
                    </button>
                    <button onClick={() => handleDeleteRec(r.id)} className="matrix-btn matrix-btn-icon matrix-btn-sm matrix-btn-danger opacity-50 hover:opacity-100"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </NeonCard>
      )}

      {/* Data tab */}
      {activeTab === 'data' && (
        <NeonCard className="p-4" animate={false}>
          <div className="flex items-center gap-2 mb-3">
            <Download size={16} className="text-[#00b347]" />
            <p className="matrix-label">{t.settings.exportData}</p>
          </div>
          <p className="text-[#3a5c3a] font-mono text-sm mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t.settings.exportDesc}</p>
          <a href="/api/export" download className="matrix-btn matrix-btn-solid inline-flex items-center gap-2">
            <Download size={13} /> {t.settings.download} JSON
          </a>
        </NeonCard>
      )}

      {/* Category modal */}
      <TerminalModal open={showCatModal} onClose={() => setShowCatModal(false)} title={t.settings.addCategory}>
        <form onSubmit={handleSaveCat} className="space-y-3">
          <div className="flex gap-2">
            <div className="w-14">
              <label className="matrix-label">Ikon</label>
              <input value={catForm.icon} onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))} className="matrix-input text-center text-xl" maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="matrix-label">Nama</label>
              <input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} className="matrix-input" required />
            </div>
          </div>
          <div className="flex gap-2">
            {(['income', 'expense'] as const).map((type) => (
              <button key={type} type="button" onClick={() => setCatForm((f) => ({ ...f, type }))}
                className={`flex-1 matrix-btn matrix-btn-sm ${catForm.type === type ? 'matrix-btn-solid' : ''}`}>
                {type === 'income' ? t.transactions.income : t.transactions.expense}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowCatModal(false)} className="matrix-btn flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={savingCat} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: savingCat ? 0.5 : 1 }}>
              {savingCat ? '> MENYIMPAN...' : `> ${t.common.save}`}
            </button>
          </div>
        </form>
      </TerminalModal>

      {/* Recurring modal */}
      <TerminalModal open={showRecModal} onClose={() => setShowRecModal(false)} title={t.settings.addRecurring}>
        <form onSubmit={handleSaveRec} className="space-y-3">
          <div className="flex gap-2">
            {(['income', 'expense'] as const).map((type) => (
              <button key={type} type="button" onClick={() => setRecForm((f) => ({ ...f, type }))}
                className={`flex-1 matrix-btn matrix-btn-sm ${recForm.type === type ? 'matrix-btn-solid' : ''}`}>
                {type === 'income' ? `▲ ${t.transactions.income}` : `▼ ${t.transactions.expense}`}
              </button>
            ))}
          </div>
          <div>
            <label className="matrix-label">{t.transactions.description}</label>
            <input value={recForm.description} onChange={(e) => setRecForm((f) => ({ ...f, description: e.target.value }))} className="matrix-input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="matrix-label">{t.transactions.amount}</label>
              <input type="number" value={recForm.amount} onChange={(e) => setRecForm((f) => ({ ...f, amount: e.target.value }))} className="matrix-input" required />
            </div>
            <div>
              <label className="matrix-label">{t.settings.frequency}</label>
              <select value={recForm.frequency} onChange={(e) => setRecForm((f) => ({ ...f, frequency: e.target.value as RecurringRule['frequency'] }))} className="matrix-input">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
                  <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="matrix-label">{t.transactions.account}</label>
              <select value={recForm.accountId} onChange={(e) => setRecForm((f) => ({ ...f, accountId: e.target.value }))} className="matrix-input" required>
                <option value="">Pilih</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="matrix-label">{t.transactions.category}</label>
              <select value={recForm.categoryId} onChange={(e) => setRecForm((f) => ({ ...f, categoryId: e.target.value }))} className="matrix-input" required>
                <option value="">Pilih</option>
                {categories.filter((c) => c.type === recForm.type).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="matrix-label">{t.settings.startDate}</label>
            <input type="date" value={recForm.startDate} onChange={(e) => setRecForm((f) => ({ ...f, startDate: e.target.value }))} className="matrix-input" style={{ colorScheme: 'dark' }} required />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowRecModal(false)} className="matrix-btn flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={savingRec} className="matrix-btn matrix-btn-solid flex-1" style={{ opacity: savingRec ? 0.5 : 1 }}>
              {savingRec ? '> MENYIMPAN...' : `> ${t.common.save}`}
            </button>
          </div>
        </form>
      </TerminalModal>
    </div>
  )
}
