'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Check, Square } from 'lucide-react'
import AriaFace, { FaceExpression } from '@/components/AriaFace'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, formatDate } from '@/lib/utils'

// ── Fallout amber palette (scoped to this page only) ──
const AMBER       = '#FFB000'
const AMBER_DIM   = '#E8C060'
const AMBER_DARK  = '#C8A040'
const AMBER_MUTED = '#6B4F00'
const AMBER_DEEP  = '#2A1E00'
const AMBER_PANEL = '#0D0900'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: string[]
}

interface TransactionConfirm {
  type: 'income' | 'expense'
  amount: number
  description: string
  categoryName: string
  accountName: string
  date: string
}

interface TransferConfirm {
  fromAccountName: string
  toAccountName: string
  amount: number
  description: string
  date: string
}

type FinancialContext = {
  netWorth: number
  savingsRate: number
  monthIncome: number
  monthExpense: number
  monthNet: number
  lastMonthIncome?: number
  lastMonthExpense?: number
  avgDailyExpense?: number
  projectedMonthExpense?: number
  daysLeftInMonth?: number
  accounts: Array<{ id: string; name: string; type: string; balance: number }>
  categories: Array<{ id: string; name: string; type: string }>
  budgets: Array<{ category: string; limit: number; spent: number; pct: number }>
  goals: Array<{ name: string; target: number; current: number; pct: number; deadline?: string; isCompleted: boolean }>
  upcomingRecurring?: Array<{ description: string; amount: number; type: string; nextDue: string; account: string }>
  today: string
}

function parseTransactionConfirm(text: string): { clean: string; confirm: TransactionConfirm | null } {
  const match = text.match(/<transaction_confirm>([\s\S]*?)<\/transaction_confirm>/)
  if (!match) return { clean: text, confirm: null }
  try {
    const confirm = JSON.parse(match[1].trim()) as TransactionConfirm
    const clean = text.replace(/<transaction_confirm>[\s\S]*?<\/transaction_confirm>/, '').trim()
    return { clean, confirm }
  } catch {
    return { clean: text, confirm: null }
  }
}

function parseTransferConfirm(text: string): { clean: string; transfer: TransferConfirm | null } {
  const match = text.match(/<transfer_confirm>([\s\S]*?)<\/transfer_confirm>/)
  if (!match) return { clean: text, transfer: null }
  try {
    const transfer = JSON.parse(match[1].trim()) as TransferConfirm
    const clean = text.replace(/<transfer_confirm>[\s\S]*?<\/transfer_confirm>/, '').trim()
    return { clean, transfer }
  } catch {
    return { clean: text, transfer: null }
  }
}

function parseSuggestions(text: string): { clean: string; suggestions: string[] } {
  const match = text.match(/<suggestions>([\s\S]*?)<\/suggestions>/)
  if (!match) return { clean: text, suggestions: [] }
  try {
    const suggestions = JSON.parse(match[1].trim()) as string[]
    const clean = text.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim()
    return { clean, suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [] }
  } catch {
    return { clean: text, suggestions: [] }
  }
}

function parseAllTags(text: string): {
  clean: string
  confirm: TransactionConfirm | null
  transfer: TransferConfirm | null
  suggestions: string[]
} {
  const { clean: c1, confirm } = parseTransactionConfirm(text)
  const { clean: c2, transfer } = parseTransferConfirm(c1)
  const { clean, suggestions } = parseSuggestions(c2)
  return { clean, confirm, transfer, suggestions }
}

function detectExpression(text: string): FaceExpression {
  const lower = text.toLowerCase()
  if (/bagus|hebat|selamat|mantap|luar biasa|terima kasih|senang|optimal/.test(lower)) return 'happy'
  if (/maaf|sedih|buruk|rugi|deficit|melebihi|peringatan|hati-hati/.test(lower)) return 'sad'
  if (/wow|luar biasa|tidak percaya|mengejutkan/.test(lower)) return 'surprised'
  if (/perhatian|peringatan|bahaya|kritis|waspada|berlebihan|darurat/.test(lower)) return 'warning'
  return 'talking'
}

function generateGreeting(data: FinancialContext): string {
  const lines: string[] = []
  lines.push(`ANALISIS SELESAI. Selamat datang, Operator.\n`)
  lines.push(`Kekayaan bersih kamu saat ini **${formatIDR(data.netWorth)}** dengan tingkat tabungan bulan ini **${data.savingsRate}%**.`)

  // MoM comparison
  if (data.lastMonthExpense && data.lastMonthExpense > 0 && data.monthExpense > 0) {
    const diff = data.monthExpense - data.lastMonthExpense
    const pct = Math.abs(Math.round((diff / data.lastMonthExpense) * 100))
    if (pct > 5) {
      lines.push(diff > 0
        ? `\n⚠ Pengeluaran bulan ini naik **${pct}%** dibanding bulan lalu (${formatIDR(data.lastMonthExpense)} → ${formatIDR(data.monthExpense)}).`
        : `\n✔ Pengeluaran bulan ini turun **${pct}%** dibanding bulan lalu — bagus!`)
    }
  }

  // Budget warnings
  const criticalBudgets = data.budgets?.filter(b => b.pct >= 80) ?? []
  criticalBudgets.forEach(b => {
    const remaining = b.limit - b.spent
    lines.push(`\n⚠ PERINGATAN: Budget **${b.category}** sudah **${b.pct}%** terpakai (sisa ${formatIDR(remaining)} dari ${formatIDR(b.limit)}).`)
  })

  // Goal deadline warnings
  if (data.today) {
    const today = new Date(data.today)
    data.goals?.filter(g => !g.isCompleted && g.deadline && g.pct < 70).forEach(g => {
      const deadline = new Date(g.deadline!)
      const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000)
      if (daysLeft > 0 && daysLeft <= 30) {
        const remaining = g.target - g.current
        const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7))
        const perWeek = Math.ceil(remaining / weeksLeft)
        lines.push(`\n⚠ Goal **${g.name}** deadline ${daysLeft} hari lagi, baru **${g.pct}%** tercapai — perlu **${formatIDR(perWeek)}/minggu** untuk mengejar target.`)
      }
    })
  }

  // Upcoming recurring
  if (data.upcomingRecurring && data.upcomingRecurring.length > 0) {
    const upcoming = data.upcomingRecurring.slice(0, 3)
    const labels = upcoming.map(r => `**${r.description}** (${formatIDR(r.amount)}) — ${r.nextDue}`).join(', ')
    lines.push(`\n📋 Tagihan jatuh tempo 7 hari ke depan: ${labels}.`)
  }

  lines.push(`\nAda yang ingin kamu tanyakan atau analisis?`)
  return lines.join('')
}

const BOOT_MESSAGES = [
  'ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL',
  'COPYRIGHT 2075-2077 ROBCO INDUSTRIES',
  '> MEMUAT SISTEM KEUANGAN ARIA...',
  '> AUTENTIKASI OPERATOR: DITERIMA',
  '> MENGHUBUNGKAN KE DATABASE KEUANGAN...',
  '> MEMUAT RIWAYAT TRANSAKSI...',
  '> KALIBRASI MODUL ANALISIS PROAKTIF...',
  '> ARIA FINANCIAL SYSTEM v3.0 - SIAP',
]

const QUICK_ACTIONS: { n: number; label: string; prompt: string }[] = [
  { n: 1, label: 'LAPORAN BULANAN',    prompt: 'Buatkan laporan keuangan bulan ini untuk saya.' },
  { n: 2, label: 'STATUS ANGGARAN',    prompt: 'Bagaimana status anggaran saya bulan ini? Sebutkan yang sudah kritis.' },
  { n: 3, label: 'PROGRES TUJUAN',     prompt: 'Tunjukkan progres tujuan keuangan saya dan apakah saya on-track.' },
  { n: 4, label: 'TIPS HEMAT',         prompt: 'Berikan tips hemat yang relevan dengan kondisi keuangan saya saat ini.' },
  { n: 5, label: 'PREDIKSI BULAN INI', prompt: 'Berdasarkan pengeluaran saya hingga hari ini, prediksi total pengeluaran bulan ini dan apakah saya perlu khawatir.' },
  { n: 6, label: 'BANDINGKAN BULAN',   prompt: 'Bandingkan keuangan bulan ini vs bulan lalu secara detail.' },
  { n: 7, label: 'UPCOMING BILLS',     prompt: 'Transaksi berulang apa yang jatuh tempo minggu ini? Berapa total yang perlu saya siapkan?' },
  { n: 8, label: 'SKOR KESEHATAN',     prompt: 'Berikan skor kesehatan keuangan saya dari 1-100 dengan penjelasan dan rekomendasi perbaikan.' },
]

const CHAT_STORAGE_KEY = 'aria-chat-v1'
const MAX_SAVED_MESSAGES = 50

export default function AIPage() {
  const { lang } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [expression, setExpression] = useState<FaceExpression>('idle')
  const [isTalking, setIsTalking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [context, setContext] = useState<FinancialContext | null>(null)
  const [bootPhase, setBootPhase] = useState<'booting' | 'ready'>('booting')
  const [bootLines, setBootLines] = useState<string[]>([])
  const [typewriterLine, setTypewriterLine] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<TransactionConfirm | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<TransferConfirm | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmResult, setConfirmResult] = useState<'success' | 'error' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const talkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBootRef = useRef(false)
  const isRestoredRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  // Restore chat from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY)
      if (!raw) return
      const { messages: saved, cachedContext } = JSON.parse(raw) as {
        messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string; suggestions?: string[] }>
        cachedContext: FinancialContext | null
      }
      if (!saved?.length) return
      skipBootRef.current = true
      isRestoredRef.current = true
      setMessages(saved.map(m => ({ ...m, timestamp: new Date(m.timestamp) })))
      if (cachedContext) setContext(cachedContext)
      setBootPhase('ready')
      setExpression('idle')
      fetch('/api/ai/context').then(r => r.json()).then(setContext).catch(() => {})
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Boot sequence typewriter
  useEffect(() => {
    if (skipBootRef.current) return
    let lineIdx = 0
    let charIdx = 0
    let cancelled = false

    const typeNextChar = () => {
      if (cancelled) return
      const currentLine = BOOT_MESSAGES[lineIdx]
      if (charIdx <= currentLine.length) {
        setTypewriterLine(currentLine.slice(0, charIdx))
        charIdx++
        setTimeout(typeNextChar, 22 + Math.random() * 16)
      } else {
        setBootLines(prev => [...prev, currentLine])
        setTypewriterLine('')
        lineIdx++
        charIdx = 0
        if (lineIdx < BOOT_MESSAGES.length) {
          setTimeout(typeNextChar, 100 + Math.random() * 140)
        } else {
          setTimeout(() => { if (!cancelled) setBootPhase('ready') }, 500)
        }
      }
    }

    setTimeout(typeNextChar, 300)
    return () => { cancelled = true }
  }, [])

  // Load context after boot
  useEffect(() => {
    if (bootPhase !== 'ready') return
    if (isRestoredRef.current) return
    fetch('/api/ai/context')
      .then(r => r.json())
      .then((data: FinancialContext) => {
        setContext(data)
        const greet: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: generateGreeting(data),
          timestamp: new Date(),
        }
        setMessages([greet])
        setExpression(data.savingsRate >= 20 ? 'happy' : data.savingsRate < 0 ? 'warning' : 'idle')
      })
      .catch(() => {
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'SISTEM AKTIF. Saya ARIA v3.0, siap membantu keuangan kamu. Koneksi database tidak tersedia saat ini.',
          timestamp: new Date(),
        }])
      })
  }, [bootPhase, lang])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (messages.length === 0 || !context) return
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        messages: messages.slice(-MAX_SAVED_MESSAGES),
        cachedContext: context,
      }))
    } catch {}
  }, [messages, context])

  const clearConversation = useCallback(() => {
    abortControllerRef.current?.abort()
    localStorage.removeItem(CHAT_STORAGE_KEY)
    skipBootRef.current = false
    isRestoredRef.current = false
    setMessages([])
    setContext(null)
    setBootPhase('booting')
    setBootLines([])
    setTypewriterLine('')
    setExpression('idle')
    setIsTalking(false)
    setPendingConfirm(null)
    setPendingTransfer(null)
    setConfirmResult(null)
    setIsStreaming(false)
  }, [])

  const triggerTalking = useCallback((durationMs: number) => {
    setIsTalking(true)
    if (talkingTimer.current) clearTimeout(talkingTimer.current)
    talkingTimer.current = setTimeout(() => {
      setIsTalking(false)
      setExpression('idle')
    }, durationMs)
  }, [])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isStreaming) return
    setInput('')
    setPendingConfirm(null)
    setPendingTransfer(null)
    setConfirmResult(null)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setExpression('thinking')
    setIsStreaming(true)

    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context }),
        signal: abortController.signal,
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let aborted = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullText += parsed.text
                const { clean } = parseAllTags(fullText)
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: clean } : m))
                if (!isTalking) {
                  setExpression(detectExpression(fullText))
                  triggerTalking(2000)
                }
              }
            } catch {}
          }
        }
      } catch (readErr) {
        if ((readErr as Error)?.name === 'AbortError') aborted = true
        else throw readErr
      }

      const { clean, confirm, transfer, suggestions } = parseAllTags(fullText)
      const finalContent = aborted ? clean + (clean ? '\n\n`[DIHENTIKAN]`' : '`[DIHENTIKAN]`') : clean
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: finalContent, suggestions: aborted ? [] : suggestions } : m
      ))
      if (!aborted) {
        if (confirm) setPendingConfirm(confirm)
        if (transfer) setPendingTransfer(transfer)
      }

      setExpression(aborted ? 'idle' : detectExpression(fullText))
      triggerTalking(1500)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // handled above via reader abort
      } else {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: 'KESALAHAN SISTEM. Koneksi terputus. Coba lagi.' } : m
        ))
        setExpression('sad')
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [input, isStreaming, messages, context, isTalking, triggerTalking])

  const handleConfirmTransaction = async (confirmed: boolean) => {
    if (!pendingConfirm) return
    if (!confirmed) { setPendingConfirm(null); return }
    setConfirmLoading(true)
    try {
      const account = context?.accounts.find(a => a.name.toLowerCase().includes(pendingConfirm.accountName.toLowerCase()))
        ?? context?.accounts[0]
      const category = context?.categories.find(
        c => c.name.toLowerCase().includes(pendingConfirm.categoryName.toLowerCase()) && c.type === pendingConfirm.type
      ) ?? context?.categories.find(c => c.type === pendingConfirm.type)

      if (!account || !category) throw new Error('Akun atau kategori tidak ditemukan')

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          categoryId: category.id,
          type: pendingConfirm.type,
          amount: pendingConfirm.amount,
          description: pendingConfirm.description,
          date: pendingConfirm.date,
          notes: 'Dibuat via ARIA AI Helper',
        }),
      })
      if (!res.ok) throw new Error()

      window.dispatchEvent(new Event('transaction:added'))
      setConfirmResult('success')
      setPendingConfirm(null)
      setExpression('happy')
      triggerTalking(2000)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `DATA TERSIMPAN. Transaksi **${pendingConfirm.description}** sebesar **${formatIDR(pendingConfirm.amount)}** berhasil dicatat.`,
        timestamp: new Date(),
      }])
      fetch('/api/ai/context').then(r => r.json()).then(setContext).catch(() => {})
    } catch {
      setConfirmResult('error')
      setExpression('sad')
    } finally {
      setConfirmLoading(false)
      setTimeout(() => setConfirmResult(null), 3000)
    }
  }

  const handleConfirmTransfer = async (confirmed: boolean) => {
    if (!pendingTransfer) return
    if (!confirmed) { setPendingTransfer(null); return }
    setConfirmLoading(true)
    try {
      const fromAccount = context?.accounts.find(a =>
        a.name.toLowerCase().includes(pendingTransfer.fromAccountName.toLowerCase())
      ) ?? context?.accounts[0]
      const toAccount = context?.accounts.find(a =>
        a.name.toLowerCase().includes(pendingTransfer.toAccountName.toLowerCase())
      )

      if (!fromAccount || !toAccount) throw new Error('Akun tidak ditemukan')
      if (fromAccount.id === toAccount.id) throw new Error('Akun asal dan tujuan sama')

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount: pendingTransfer.amount,
          description: pendingTransfer.description,
          date: pendingTransfer.date,
        }),
      })
      if (!res.ok) throw new Error()

      window.dispatchEvent(new Event('transaction:added'))
      setConfirmResult('success')
      setPendingTransfer(null)
      setExpression('happy')
      triggerTalking(2000)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `DATA TERSIMPAN. Transfer **${formatIDR(pendingTransfer.amount)}** dari **${pendingTransfer.fromAccountName}** ke **${pendingTransfer.toAccountName}** berhasil dicatat.`,
        timestamp: new Date(),
      }])
      fetch('/api/ai/context').then(r => r.json()).then(setContext).catch(() => {})
    } catch {
      setConfirmResult('error')
      setExpression('sad')
    } finally {
      setConfirmLoading(false)
      setTimeout(() => setConfirmResult(null), 3000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── BOOT SCREEN ──
  if (bootPhase === 'booting') {
    return (
      <div
        className="flex items-start justify-start min-h-[80vh] p-6 md:p-12"
        style={{ fontFamily: 'JetBrains Mono, monospace', background: '#000' }}
      >
        <div className="w-full max-w-2xl">
          <div style={{ borderBottom: `1px solid ${AMBER_MUTED}`, paddingBottom: 10, marginBottom: 12 }}>
            <p style={{ color: AMBER, fontSize: '0.75rem', letterSpacing: '0.16em', fontWeight: 700 }}
               className="aria-amber-glow">
              ROBCO INDUSTRIES UNIFIED OPERATING SYSTEM
            </p>
            <p style={{ color: AMBER_MUTED, fontSize: '0.62rem', letterSpacing: '0.1em', marginTop: 3 }}>
              JAGA UANG FINANCIAL TERMINAL  ──  v3.0
            </p>
          </div>
          {bootLines.map((line, i) => (
            <div key={i} style={{
              color: i < 2 ? AMBER_MUTED : AMBER_DIM,
              fontSize: '0.7rem', lineHeight: '1.9', letterSpacing: '0.04em',
            }}>
              {line}
            </div>
          ))}
          {typewriterLine !== '' && (
            <div style={{ color: AMBER_DIM, fontSize: '0.7rem', lineHeight: '1.9', letterSpacing: '0.04em' }}>
              {typewriterLine}
              <span style={{ color: AMBER, animation: 'type-cursor 1s infinite steps(1)' }}>█</span>
            </div>
          )}
          {typewriterLine === '' && bootLines.length < BOOT_MESSAGES.length && (
            <span style={{ color: AMBER, animation: 'type-cursor 1s infinite steps(1)', fontSize: '0.7rem' }}>█</span>
          )}
        </div>
      </div>
    )
  }

  // ── MAIN UI ──
  return (
    <motion.div
      className="flex flex-col md:flex-row h-[calc(100dvh-5rem)] md:h-[calc(100dvh-1rem)] max-w-6xl mx-auto"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >

      {/* ── LEFT PANEL: Avatar + Status (desktop only) ── */}
      <motion.div
        className="hidden md:flex md:flex-col md:items-stretch md:w-[220px] md:shrink-0 md:h-full"
        style={{ borderRight: `1px solid ${AMBER_MUTED}`, background: AMBER_PANEL }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.1 }}
      >
        <div className="hidden md:block w-full px-3 py-2" style={{ borderBottom: `1px solid ${AMBER_MUTED}` }}>
          <p style={{ color: AMBER_MUTED, fontSize: '0.48rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ROBCO INDUSTRIES
          </p>
          <p className="aria-amber-glow" style={{ color: AMBER, fontSize: '0.58rem', letterSpacing: '0.12em', fontWeight: 700, marginTop: 1 }}>
            ARIA FINANCIAL SYSTEM
          </p>
        </div>

        <div className="flex items-center justify-center py-2 md:py-4 px-2 shrink-0 md:flex-none">
          <AriaFace
            expression={isStreaming ? 'thinking' : isTalking ? expression : 'idle'}
            isTalking={isTalking && !isStreaming}
          />
        </div>

        <div className="hidden md:block w-full px-3 pb-3 mt-auto" style={{ borderTop: `1px solid ${AMBER_MUTED}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'OPERATOR', value: 'AUTH ●' },
              { label: 'SIGNAL',   value: '████▒' },
              { label: 'MODEL',    value: 'HAIKU' },
              { label: 'STATUS',   value: isStreaming ? 'MEMPROSES' : 'SIAP' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: AMBER_MUTED, fontSize: '0.48rem', letterSpacing: '0.12em' }}>{label}</span>
                <motion.span
                  style={{ color: label === 'STATUS' && isStreaming ? AMBER_DARK : AMBER, fontSize: '0.52rem' }}
                  animate={{ opacity: label === 'STATUS' && isStreaming ? [0.5, 1, 0.5] : 1 }}
                  transition={{ duration: 1, repeat: label === 'STATUS' && isStreaming ? Infinity : 0 }}
                >
                  {value}
                </motion.span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${AMBER_MUTED}`, paddingTop: 6, marginTop: 2 }}>
              <span style={{ color: AMBER_MUTED, fontSize: '0.45rem', letterSpacing: '0.1em' }}>{today}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Mobile compact header */}
        <div className="flex md:hidden items-center gap-2 px-3 py-1.5 shrink-0" style={{
          background: AMBER_PANEL,
          borderBottom: `1px solid ${AMBER_MUTED}`,
        }}>
          <div style={{ width: 66, height: 79, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ transform: 'scale(0.33)', transformOrigin: 'top left', width: 200, height: 240 }}>
              <AriaFace
                expression={isStreaming ? 'thinking' : isTalking ? expression : 'idle'}
                isTalking={isTalking && !isStreaming}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: AMBER_MUTED, fontSize: '0.42rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              ROBCO INDUSTRIES
            </p>
            <p className="aria-amber-glow" style={{ color: AMBER, fontSize: '0.58rem', letterSpacing: '0.1em', fontWeight: 700 }}>
              ARIA FINANCIAL SYSTEM
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ color: AMBER_MUTED, fontSize: '0.42rem', letterSpacing: '0.06em' }}>
              SIGNAL: <span style={{ color: AMBER }}>████▒</span>
            </p>
            <motion.p
              style={{ color: isStreaming ? AMBER_DARK : AMBER, fontSize: '0.42rem', letterSpacing: '0.06em' }}
              animate={{ opacity: isStreaming ? [0.5, 1, 0.5] : 1 }}
              transition={{ duration: 1, repeat: isStreaming ? Infinity : 0 }}
            >
              {isStreaming ? 'MEMPROSES' : 'SIAP'}
            </motion.p>
          </div>
        </div>

        {/* Terminal header */}
        <div style={{ borderBottom: `1px solid ${AMBER_MUTED}`, background: AMBER_PANEL, padding: '8px 16px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="aria-amber-glow" style={{ color: AMBER, fontSize: '0.62rem', letterSpacing: '0.14em', fontWeight: 700 }}>
              ROBCO INDUSTRIES TERMLINK PROTOCOL
            </p>
            <p style={{ color: AMBER_MUTED, fontSize: '0.52rem', letterSpacing: '0.08em', marginTop: 2 }}>
              ARIA v3.0  ──  HAIKU  ──  OPERATOR: AUTH  ──  {today}
            </p>
          </div>
          <button
            onClick={clearConversation}
            title="Mulai percakapan baru"
            style={{
              background: 'transparent',
              border: `1px solid ${AMBER_MUTED}`,
              borderRadius: 2,
              color: AMBER_MUTED,
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.5rem', fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '3px 6px',
              flexShrink: 0,
              transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = AMBER_MUTED; e.currentTarget.style.color = AMBER_MUTED }}
          >
            [NEW]
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: msg.role === 'user' ? 8 : -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                style={{ paddingTop: 8, paddingBottom: 8 }}
              >
                {idx > 0 && (
                  <div style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${AMBER_MUTED}50, transparent)`,
                    marginBottom: 10,
                  }} />
                )}
                <div>
                  {msg.role === 'assistant' ? (
                    <>
                      <span style={{ color: AMBER, fontSize: '0.68rem', fontWeight: 700, marginRight: 4 }}>[ARIA]</span>
                      <span
                        style={{ color: AMBER_DIM, fontSize: '0.72rem', lineHeight: 1.75 }}
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${AMBER}">$1</strong>`)
                            .replace(/`([^`]+)`/g, `<code style="color:${AMBER_DARK};background:rgba(255,176,0,0.08);padding:1px 4px;border-radius:2px">$1</code>`)
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                      {msg.content === '' && isStreaming && (
                        <span style={{ display: 'inline-flex', gap: 3, verticalAlign: 'middle', marginLeft: 4 }}>
                          {[0, 1, 2].map(i => (
                            <motion.span
                              key={i}
                              style={{ width: 5, height: 5, background: AMBER, display: 'inline-block', borderRadius: 1 }}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </span>
                      )}
                      {/* Suggestion chips */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                          {msg.suggestions.map((s, si) => (
                            <button
                              key={si}
                              onClick={() => !isStreaming && sendMessage(s)}
                              disabled={isStreaming}
                              style={{
                                background: 'transparent',
                                border: `1px solid ${AMBER_MUTED}`,
                                borderRadius: 2,
                                color: AMBER_DARK,
                                cursor: 'pointer',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.54rem',
                                letterSpacing: '0.03em',
                                padding: '3px 7px',
                                opacity: isStreaming ? 0.4 : 1,
                                transition: 'border-color 0.1s, color 0.1s',
                                textAlign: 'left',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = AMBER_MUTED; e.currentTarget.style.color = AMBER_DARK }}
                            >
                              ↳ {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ color: AMBER_MUTED, fontSize: '0.68rem', fontWeight: 700, marginRight: 4 }}>[ANDA]</span>
                      <span style={{ color: AMBER_DARK, fontSize: '0.72rem', lineHeight: 1.75 }}>
                        {msg.content}
                      </span>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Transaction confirm card */}
          <AnimatePresence>
            {pendingConfirm && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{
                  border: `1px solid ${AMBER_MUTED}`,
                  background: AMBER_DEEP,
                  borderRadius: 2,
                  padding: '12px 14px',
                  maxWidth: 440,
                  marginTop: 10,
                }}
              >
                <p style={{ color: AMBER_MUTED, fontSize: '0.55rem', letterSpacing: '0.15em', marginBottom: 10, fontWeight: 700 }}>
                  ── KONFIRMASI TRANSAKSI ──
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  {[
                    { label: 'JENIS',     value: pendingConfirm.type === 'income' ? '▲ PEMASUKAN' : '▼ PENGELUARAN', color: pendingConfirm.type === 'income' ? '#00ff41' : '#ff2055' },
                    { label: 'JUMLAH',    value: formatIDR(pendingConfirm.amount), color: AMBER },
                    { label: 'DESKRIPSI', value: pendingConfirm.description,       color: AMBER_DIM },
                    { label: 'KATEGORI',  value: pendingConfirm.categoryName,      color: AMBER_DARK },
                    { label: 'AKUN',      value: pendingConfirm.accountName,       color: AMBER_DARK },
                    { label: 'TANGGAL',   value: formatDate(pendingConfirm.date, 'dd MMM yyyy', lang), color: AMBER_DARK },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <span style={{ color: AMBER_MUTED, fontSize: '0.6rem' }}>{label}</span>
                      <span style={{ color, fontSize: '0.6rem', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleConfirmTransaction(false)} disabled={confirmLoading}
                    style={{ flex: 1, background: 'transparent', border: `1px solid ${AMBER_MUTED}`, borderRadius: 2, color: AMBER_MUTED, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', padding: '5px 8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <X size={10} /> BATALKAN
                  </button>
                  <button onClick={() => handleConfirmTransaction(true)} disabled={confirmLoading}
                    style={{ flex: 1, background: `rgba(255,176,0,0.1)`, border: `1px solid ${AMBER}`, borderRadius: 2, color: AMBER, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', padding: '5px 8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: confirmLoading ? 0.6 : 1 }}>
                    <Check size={10} /> {confirmLoading ? 'MENYIMPAN...' : 'YA, CATAT'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transfer confirm card */}
          <AnimatePresence>
            {pendingTransfer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{
                  border: `1px solid ${AMBER_MUTED}`,
                  background: AMBER_DEEP,
                  borderRadius: 2,
                  padding: '12px 14px',
                  maxWidth: 440,
                  marginTop: 10,
                }}
              >
                <p style={{ color: AMBER_MUTED, fontSize: '0.55rem', letterSpacing: '0.15em', marginBottom: 10, fontWeight: 700 }}>
                  ── KONFIRMASI TRANSFER ──
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  {[
                    { label: 'DARI',      value: pendingTransfer.fromAccountName, color: '#ff2055' },
                    { label: 'KE',        value: pendingTransfer.toAccountName,   color: '#00ff41' },
                    { label: 'JUMLAH',    value: formatIDR(pendingTransfer.amount), color: AMBER },
                    { label: 'DESKRIPSI', value: pendingTransfer.description,     color: AMBER_DIM },
                    { label: 'TANGGAL',   value: formatDate(pendingTransfer.date, 'dd MMM yyyy', lang), color: AMBER_DARK },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <span style={{ color: AMBER_MUTED, fontSize: '0.6rem' }}>{label}</span>
                      <span style={{ color, fontSize: '0.6rem', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleConfirmTransfer(false)} disabled={confirmLoading}
                    style={{ flex: 1, background: 'transparent', border: `1px solid ${AMBER_MUTED}`, borderRadius: 2, color: AMBER_MUTED, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', padding: '5px 8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <X size={10} /> BATALKAN
                  </button>
                  <button onClick={() => handleConfirmTransfer(true)} disabled={confirmLoading}
                    style={{ flex: 1, background: `rgba(255,176,0,0.1)`, border: `1px solid ${AMBER}`, borderRadius: 2, color: AMBER, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', padding: '5px 8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: confirmLoading ? 0.6 : 1 }}>
                    <Check size={10} /> {confirmLoading ? 'MEMPROSES...' : 'YA, TRANSFER'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm result */}
          <AnimatePresence>
            {confirmResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: '0.65rem', color: confirmResult === 'success' ? AMBER : '#ff2055', padding: '6px 0', letterSpacing: '0.06em' }}
              >
                {confirmResult === 'success' ? '[OK] OPERASI BERHASIL DICATAT' : '[ERR] GAGAL — COBA LAGI'}
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* ── INPUT ZONE ── */}
        <motion.div
          style={{ borderTop: `1px solid ${AMBER_MUTED}`, background: AMBER_PANEL, padding: '10px 16px 14px', flexShrink: 0 }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', marginBottom: 10, paddingBottom: 2 }}>
            {QUICK_ACTIONS.map(({ n, label, prompt }) => (
              <button
                key={n}
                onClick={() => sendMessage(prompt)}
                disabled={isStreaming}
                style={{
                  background: 'transparent',
                  border: `1px solid ${AMBER_MUTED}`,
                  borderRadius: 2,
                  color: AMBER_DARK,
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.56rem', fontWeight: 600,
                  letterSpacing: '0.06em',
                  padding: '3px 7px',
                  textTransform: 'uppercase',
                  opacity: isStreaming ? 0.4 : 1,
                  transition: 'border-color 0.1s, color 0.1s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!isStreaming) { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = AMBER_MUTED; e.currentTarget.style.color = AMBER_DARK }}
              >
                [{n}] {label}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: AMBER, fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.9rem', pointerEvents: 'none', lineHeight: 1,
              }}>›</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                placeholder="Masukkan perintah..."
                autoComplete="off"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${input ? AMBER : AMBER_MUTED}`,
                  borderRadius: 2,
                  color: AMBER_DIM,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.78rem',
                  padding: '7px 10px 7px 26px',
                  width: '100%',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  opacity: isStreaming ? 0.6 : 1,
                }}
              />
            </div>
            <motion.button
              onClick={isStreaming ? stopStreaming : () => sendMessage()}
              disabled={!isStreaming && !input.trim()}
              style={{
                background: isStreaming ? 'rgba(255,32,85,0.1)' : input.trim() ? 'rgba(255,176,0,0.12)' : 'transparent',
                border: `1px solid ${isStreaming ? '#ff2055' : input.trim() ? AMBER : AMBER_MUTED}`,
                borderRadius: 2,
                color: isStreaming ? '#ff2055' : input.trim() ? AMBER : AMBER_MUTED,
                cursor: (!isStreaming && !input.trim()) ? 'not-allowed' : 'pointer',
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (!isStreaming && !input.trim()) ? 0.4 : 1,
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              whileTap={{ scale: 0.92 }}
              title={isStreaming ? 'Hentikan' : 'Kirim'}
            >
              {isStreaming ? <Square size={11} fill="currentColor" /> : <Send size={13} />}
            </motion.button>
          </div>

          <p style={{
            fontSize: '0.48rem', color: AMBER_MUTED,
            textAlign: 'center', marginTop: 7, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            ARIA DAPAT MEMBUAT KESALAHAN. VERIFIKASI KEPUTUSAN KEUANGAN DENGAN PROFESIONAL.
          </p>
        </motion.div>

      </div>
    </motion.div>
  )
}
