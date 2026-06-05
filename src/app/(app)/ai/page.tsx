'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Check, RotateCcw } from 'lucide-react'
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
}

interface TransactionConfirm {
  type: 'income' | 'expense'
  amount: number
  description: string
  categoryName: string
  accountName: string
  date: string
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

function detectExpression(text: string): FaceExpression {
  const lower = text.toLowerCase()
  if (/bagus|hebat|selamat|mantap|luar biasa|terima kasih|senang|optimal/.test(lower)) return 'happy'
  if (/maaf|sedih|buruk|rugi|deficit|melebihi|peringatan|hati-hati/.test(lower)) return 'sad'
  if (/wow|luar biasa|tidak percaya|mengejutkan/.test(lower)) return 'surprised'
  if (/perhatian|peringatan|bahaya|kritis|waspada|berlebihan/.test(lower)) return 'warning'
  return 'talking'
}

const BOOT_MESSAGES = [
  'ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL',
  'COPYRIGHT 2075-2077 ROBCO INDUSTRIES',
  '> MEMUAT SISTEM KEUANGAN ARIA...',
  '> AUTENTIKASI OPERATOR: DITERIMA',
  '> MENGHUBUNGKAN KE DATABASE KEUANGAN...',
  '> MEMUAT RIWAYAT TRANSAKSI...',
  '> KALIBRASI MODUL ANALISIS...',
  '> ARIA FINANCIAL SYSTEM v2.0 - SIAP',
]

const QUICK_ACTIONS: { n: number; label: string; prompt: string }[] = [
  { n: 1, label: 'LAPORAN BULANAN',  prompt: 'Buatkan laporan keuangan bulan ini untuk saya.' },
  { n: 2, label: 'STATUS ANGGARAN',  prompt: 'Bagaimana status anggaran saya bulan ini?' },
  { n: 3, label: 'PROGRES TUJUAN',   prompt: 'Tunjukkan progres tujuan keuangan saya.' },
  { n: 4, label: 'TIPS HEMAT',       prompt: 'Berikan tips hemat yang relevan dengan kondisi keuangan saya.' },
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
  const [context, setContext] = useState<Record<string, unknown> | null>(null)
  const [bootPhase, setBootPhase] = useState<'booting' | 'ready'>('booting')
  const [bootLines, setBootLines] = useState<string[]>([])
  const [typewriterLine, setTypewriterLine] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<TransactionConfirm | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmResult, setConfirmResult] = useState<'success' | 'error' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const talkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBootRef = useRef(false)    // true when restoring from localStorage
  const isRestoredRef = useRef(false)  // true when messages already loaded from storage
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  // Restore chat from localStorage — runs first, before boot sequence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY)
      if (!raw) return
      const { messages: saved, cachedContext } = JSON.parse(raw) as {
        messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>
        cachedContext: Record<string, unknown> | null
      }
      if (!saved?.length) return
      skipBootRef.current = true
      isRestoredRef.current = true
      setMessages(saved.map(m => ({ ...m, timestamp: new Date(m.timestamp) })))
      if (cachedContext) setContext(cachedContext)
      setBootPhase('ready')
      setExpression('idle')
      // Re-fetch context silently to get latest financial data
      fetch('/api/ai/context').then(r => r.json()).then(setContext).catch(() => {})
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Boot sequence — typewriter per character
  useEffect(() => {
    if (skipBootRef.current) return  // already restored from localStorage, skip boot
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

  // Load context after boot — skipped when restored from localStorage
  useEffect(() => {
    if (bootPhase !== 'ready') return
    if (isRestoredRef.current) return  // already fetched silently in mount effect
    fetch('/api/ai/context')
      .then(r => r.json())
      .then(data => {
        setContext(data)
        const greet: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `ANALISIS SELESAI. Selamat datang, Operator.\n\nKekayaan bersih kamu saat ini **${formatIDR(data.netWorth)}** dengan tingkat tabungan bulan ini **${data.savingsRate}%**.\n\nAda yang ingin kamu tanyakan atau analisis?`,
          timestamp: new Date(),
        }
        setMessages([greet])
        setExpression(data.savingsRate >= 20 ? 'happy' : 'idle')
      })
      .catch(() => {
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'SISTEM AKTIF. Saya ARIA, siap membantu keuangan kamu. Koneksi database tidak tersedia saat ini.',
          timestamp: new Date(),
        }])
      })
  }, [bootPhase, lang])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist chat to localStorage whenever messages or context changes
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
    setConfirmResult(null)
  }, [])

  const triggerTalking = useCallback((durationMs: number) => {
    setIsTalking(true)
    if (talkingTimer.current) clearTimeout(talkingTimer.current)
    talkingTimer.current = setTimeout(() => {
      setIsTalking(false)
      setExpression('idle')
    }, durationMs)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    setPendingConfirm(null)
    setConfirmResult(null)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setExpression('thinking')
    setIsStreaming(true)

    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context }),
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

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
              const { clean } = parseTransactionConfirm(fullText)
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: clean } : m))
              if (!isTalking) {
                setExpression(detectExpression(fullText))
                triggerTalking(2000)
              }
            }
          } catch {}
        }
      }

      const { clean, confirm } = parseTransactionConfirm(fullText)
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: clean } : m))
      if (confirm) setPendingConfirm(confirm)

      setExpression(detectExpression(fullText))
      triggerTalking(1500)
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'KESALAHAN SISTEM. Koneksi terputus. Coba lagi.' } : m
      ))
      setExpression('sad')
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, messages, context, isTalking, triggerTalking])

  const handleConfirmTransaction = async (confirmed: boolean) => {
    if (!pendingConfirm) return
    if (!confirmed) { setPendingConfirm(null); return }

    setConfirmLoading(true)
    try {
      const ctx = context as {
        accounts: Array<{ id: string; name: string }>
        categories: Array<{ id: string; name: string; type: string }>
      } | null

      const account = ctx?.accounts.find(a => a.name.toLowerCase().includes(pendingConfirm.accountName.toLowerCase()))
        ?? ctx?.accounts[0]
      const category = ctx?.categories.find(
        c => c.name.toLowerCase().includes(pendingConfirm.categoryName.toLowerCase()) && c.type === pendingConfirm.type
      ) ?? ctx?.categories.find(c => c.type === pendingConfirm.type)

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
          {/* Header block */}
          <div style={{ borderBottom: `1px solid ${AMBER_MUTED}`, paddingBottom: 10, marginBottom: 12 }}>
            <p style={{ color: AMBER, fontSize: '0.75rem', letterSpacing: '0.16em', fontWeight: 700 }}
               className="aria-amber-glow">
              ROBCO INDUSTRIES UNIFIED OPERATING SYSTEM
            </p>
            <p style={{ color: AMBER_MUTED, fontSize: '0.62rem', letterSpacing: '0.1em', marginTop: 3 }}>
              JAGA UANG FINANCIAL TERMINAL  ──  v2.0
            </p>
          </div>

          {/* Completed lines */}
          {bootLines.map((line, i) => (
            <div key={i} style={{
              color: i < 2 ? AMBER_MUTED : AMBER_DIM,
              fontSize: '0.7rem', lineHeight: '1.9', letterSpacing: '0.04em',
            }}>
              {line}
            </div>
          ))}

          {/* Currently typing line */}
          {typewriterLine !== '' && (
            <div style={{ color: AMBER_DIM, fontSize: '0.7rem', lineHeight: '1.9', letterSpacing: '0.04em' }}>
              {typewriterLine}
              <span style={{ color: AMBER, animation: 'type-cursor 1s infinite steps(1)' }}>█</span>
            </div>
          )}

          {/* Waiting cursor when between lines */}
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
        {/* RobCo header — desktop only */}
        <div className="hidden md:block w-full px-3 py-2" style={{ borderBottom: `1px solid ${AMBER_MUTED}` }}>
          <p style={{ color: AMBER_MUTED, fontSize: '0.48rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ROBCO INDUSTRIES
          </p>
          <p className="aria-amber-glow" style={{ color: AMBER, fontSize: '0.58rem', letterSpacing: '0.12em', fontWeight: 700, marginTop: 1 }}>
            ARIA FINANCIAL SYSTEM
          </p>
        </div>

        {/* Face */}
        <div className="flex items-center justify-center py-2 md:py-4 px-2 shrink-0 md:flex-none">
          <AriaFace
            expression={isStreaming ? 'thinking' : isTalking ? expression : 'idle'}
            isTalking={isTalking && !isStreaming}
          />
        </div>

        {/* Status indicators — desktop only */}
        <div className="hidden md:block w-full px-3 pb-3 mt-auto" style={{ borderTop: `1px solid ${AMBER_MUTED}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'OPERATOR', value: 'AUTH ●' },
              { label: 'SIGNAL',   value: '████▒' },
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

      {/* ── RIGHT PANEL: Terminal output + input ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* ── MOBILE COMPACT HEADER (hidden on md+) ── */}
        <div className="flex md:hidden items-center gap-2 px-3 py-1.5 shrink-0" style={{
          background: AMBER_PANEL,
          borderBottom: `1px solid ${AMBER_MUTED}`,
        }}>
          {/* Scaled avatar — 200×240 → scale 0.33 → ~66×79 */}
          <div style={{ width: 66, height: 79, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ transform: 'scale(0.33)', transformOrigin: 'top left', width: 200, height: 240 }}>
              <AriaFace
                expression={isStreaming ? 'thinking' : isTalking ? expression : 'idle'}
                isTalking={isTalking && !isStreaming}
              />
            </div>
          </div>
          {/* ARIA info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: AMBER_MUTED, fontSize: '0.42rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              ROBCO INDUSTRIES
            </p>
            <p className="aria-amber-glow" style={{ color: AMBER, fontSize: '0.58rem', letterSpacing: '0.1em', fontWeight: 700 }}>
              ARIA FINANCIAL SYSTEM
            </p>
          </div>
          {/* Status */}
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
              ARIA FINANCIAL SYSTEM v2.0  ──  OPERATOR: AUTH  ──  {today}
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
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = AMBER
              e.currentTarget.style.color = AMBER
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = AMBER_MUTED
              e.currentTarget.style.color = AMBER_MUTED
            }}
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
                {/* Separator */}
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
                  <button
                    onClick={() => handleConfirmTransaction(false)}
                    disabled={confirmLoading}
                    style={{
                      flex: 1, background: 'transparent',
                      border: `1px solid ${AMBER_MUTED}`, borderRadius: 2,
                      color: AMBER_MUTED, cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em',
                      padding: '5px 8px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    <X size={10} /> BATALKAN
                  </button>
                  <button
                    onClick={() => handleConfirmTransaction(true)}
                    disabled={confirmLoading}
                    style={{
                      flex: 1, background: `rgba(255,176,0,0.1)`,
                      border: `1px solid ${AMBER}`, borderRadius: 2,
                      color: AMBER, cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em',
                      padding: '5px 8px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      opacity: confirmLoading ? 0.6 : 1,
                    }}
                  >
                    <Check size={10} /> {confirmLoading ? 'MENYIMPAN...' : 'YA, CATAT'}
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
                style={{
                  fontSize: '0.65rem',
                  color: confirmResult === 'success' ? AMBER : '#ff2055',
                  padding: '6px 0', letterSpacing: '0.06em',
                }}
              >
                {confirmResult === 'success' ? '[OK] TRANSAKSI BERHASIL DICATAT' : '[ERR] GAGAL MENCATAT TRANSAKSI'}
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
          {/* Quick action buttons — wrap on desktop, scroll on mobile */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', marginBottom: 10, paddingBottom: 2 }}>
            {QUICK_ACTIONS.map(({ n, label, prompt }) => (
              <button
                key={n}
                onClick={() => {
                  setInput(prompt)
                  inputRef.current?.focus()
                }}
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
                onMouseEnter={e => {
                  if (!isStreaming) {
                    const btn = e.currentTarget
                    btn.style.borderColor = AMBER
                    btn.style.color = AMBER
                  }
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget
                  btn.style.borderColor = AMBER_MUTED
                  btn.style.color = AMBER_DARK
                }}
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
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              style={{
                background: input.trim() && !isStreaming ? 'rgba(255,176,0,0.12)' : 'transparent',
                border: `1px solid ${input.trim() && !isStreaming ? AMBER : AMBER_MUTED}`,
                borderRadius: 2,
                color: input.trim() && !isStreaming ? AMBER : AMBER_MUTED,
                cursor: 'pointer',
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: isStreaming || !input.trim() ? 0.4 : 1,
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              whileTap={{ scale: 0.92 }}
            >
              {isStreaming ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RotateCcw size={13} />
                </motion.div>
              ) : (
                <Send size={13} />
              )}
            </motion.button>
          </div>

          <p style={{
            fontSize: '0.48rem', color: AMBER_MUTED,
            textAlign: 'center', marginTop: 7, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            ARIA DAPAT MEMBUAT KESALAHAN. VERIFIKASI KEPUTUSAN KEUANGAN DENGAN PROFESIONAL.
          </p>
        </motion.div>

      </div>{/* end right panel */}
    </motion.div>
  )
}
