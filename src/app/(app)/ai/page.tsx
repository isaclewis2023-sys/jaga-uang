'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Check, RotateCcw } from 'lucide-react'
import AriaFace, { FaceExpression } from '@/components/AriaFace'
import GlitchText from '@/components/matrix/GlitchText'
import NeonCard from '@/components/matrix/NeonCard'
import { useLanguage } from '@/hooks/useLanguage'
import { formatIDR, formatDate } from '@/lib/utils'

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

// Parse <transaction_confirm> from AI response
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

// Detect expression from text content
function detectExpression(text: string): FaceExpression {
  const lower = text.toLowerCase()
  if (/bagus|hebat|selamat|mantap|luar biasa|terima kasih|senang/.test(lower)) return 'happy'
  if (/maaf|sedih|buruk|rugi|deficit|melebihi|peringatan|hati-hati/.test(lower)) return 'sad'
  if (/wow|luar biasa|tidak percaya|mengejutkan/.test(lower)) return 'surprised'
  if (/perhatian|peringatan|bahaya|kritis|waspada|berlebihan/.test(lower)) return 'warning'
  return 'talking'
}

const BOOT_MESSAGES = [
  '> INISIALISASI ARIA...',
  '> MEMUAT KONTEKS KEUANGAN...',
  '> MENGHUBUNGKAN KE DATABASE...',
  '> KALIBRASI NEURAL CORE...',
  '> ARIA SIAP',
]

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
  const [pendingConfirm, setPendingConfirm] = useState<TransactionConfirm | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmResult, setConfirmResult] = useState<'success' | 'error' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const talkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Boot sequence
  useEffect(() => {
    let i = 0
    const next = () => {
      if (i < BOOT_MESSAGES.length) {
        setBootLines((prev) => [...prev, BOOT_MESSAGES[i]])
        i++
        setTimeout(next, 320 + Math.random() * 200)
      } else {
        setTimeout(() => setBootPhase('ready'), 400)
      }
    }
    setTimeout(next, 300)
  }, [])

  // Load context after boot
  useEffect(() => {
    if (bootPhase !== 'ready') return
    fetch('/api/ai/context')
      .then((r) => r.json())
      .then((data) => {
        setContext(data)
        // Greeting message
        const greet: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Halo! Saya ARIA, asisten keuangan pribadi Anda. Saya sudah membaca data keuangan Anda hari ini.\n\nKekayaan bersih Anda saat ini **${formatIDR(data.netWorth)}** dengan tingkat tabungan bulan ini **${data.savingsRate}%**.\n\nAda yang ingin Anda tanyakan atau bahas tentang keuangan Anda?`,
          timestamp: new Date(),
        }
        setMessages([greet])
        setExpression(data.savingsRate >= 20 ? 'happy' : 'idle')
      })
      .catch(() => {
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Halo! Saya ARIA. Saya siap membantu keuangan Anda, meski saat ini saya belum bisa membaca data Anda.',
          timestamp: new Date(),
        }])
      })
  }, [bootPhase, lang])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    setMessages((prev) => [...prev, userMsg])
    setExpression('thinking')
    setIsStreaming(true)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
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
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: clean } : m))
              // Animate talking while streaming
              if (!isTalking) {
                setExpression(detectExpression(fullText))
                triggerTalking(2000)
              }
            }
          } catch {}
        }
      }

      // Final parse for transaction confirm
      const { clean, confirm } = parseTransactionConfirm(fullText)
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: clean } : m))
      if (confirm) setPendingConfirm(confirm)

      setExpression(detectExpression(fullText))
      triggerTalking(1500)
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: 'Maaf, saya mengalami gangguan koneksi. Coba lagi ya.' } : m
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
      // Resolve account and category IDs from names
      const ctx = context as {
        accounts: Array<{ id: string; name: string }>
        categories: Array<{ id: string; name: string; type: string }>
      } | null

      const account = ctx?.accounts.find((a) => a.name.toLowerCase().includes(pendingConfirm.accountName.toLowerCase()))
        ?? ctx?.accounts[0]
      const category = ctx?.categories.find(
        (c) => c.name.toLowerCase().includes(pendingConfirm.categoryName.toLowerCase()) && c.type === pendingConfirm.type
      ) ?? ctx?.categories.find((c) => c.type === pendingConfirm.type)

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
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `✓ Transaksi **${pendingConfirm.description}** sebesar **${formatIDR(pendingConfirm.amount)}** berhasil dicatat!`,
        timestamp: new Date(),
      }])
      // Refresh context
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
      <div className="flex items-center justify-center min-h-[80vh]">
        <motion.div
          className="space-y-2 w-72"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="text-center mb-6"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="font-mono text-[#00ff41] text-lg font-bold tracking-widest text-glow" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              ARIA
            </span>
          </motion.div>
          {bootLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="font-mono text-xs text-[#00b347]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {line}
              {i === bootLines.length - 1 && <span className="cursor-blink ml-1">_</span>}
            </motion.div>
          ))}
        </motion.div>
      </div>
    )
  }

  // ── MAIN UI ──
  return (
    <motion.div
      className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-1rem)] max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── HEADER with face ── */}
      <motion.div
        className="flex flex-col items-center pt-4 pb-2 shrink-0"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
      >
        {/* Face */}
        <AriaFace expression={isStreaming ? 'thinking' : isTalking ? expression : 'idle'} isTalking={isTalking && !isStreaming} />

        {/* Name + subtitle */}
        <div className="text-center mt-1">
          <GlitchText
            text="ARIA"
            tag="h2"
            className="text-base font-bold font-mono tracking-[0.3em] text-glow"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00ff41' } as React.CSSProperties}
          />
          <p className="text-[#3a5c3a] font-mono text-[0.6rem] tracking-widest mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            ADAPTIVE REAL-TIME INTELLIGENCE ASSISTANT
          </p>
        </div>

        {/* Divider */}
        <motion.div
          className="w-full max-w-lg h-px mt-3"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.3), transparent)' }}
        />
      </motion.div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[65%] rounded-xl px-4 py-2.5 font-mono text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.25)] text-[#c8ffc8]'
                    : 'bg-[rgba(0,179,71,0.05)] border border-[rgba(0,255,65,0.12)] text-[#a0e8a0]'
                }`}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {msg.role === 'assistant' && (
                  <span className="text-[#3a5c3a] text-[0.6rem] block mb-1 tracking-widest">ARIA &gt;</span>
                )}
                {/* Render bold markdown */}
                <span dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#00ff41">$1</strong>')
                    .replace(/\n/g, '<br/>')
                }} />
                {msg.role === 'assistant' && msg.content === '' && isStreaming && (
                  <span className="inline-flex gap-1">
                    {[0,1,2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#00b347] inline-block"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Transaction confirm card */}
        <AnimatePresence>
          {pendingConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="flex justify-start"
            >
              <NeonCard className="max-w-[80%] md:max-w-[65%] p-4" animate={false}>
                <p className="matrix-label text-[0.6rem] mb-3">KONFIRMASI TRANSAKSI</p>
                <div className="space-y-1.5 mb-4">
                  {[
                    { label: 'Jenis', value: pendingConfirm.type === 'income' ? '▲ Pemasukan' : '▼ Pengeluaran', color: pendingConfirm.type === 'income' ? '#00ff41' : '#ff2055' },
                    { label: 'Jumlah', value: formatIDR(pendingConfirm.amount), color: '#c8ffc8' },
                    { label: 'Deskripsi', value: pendingConfirm.description, color: '#c8ffc8' },
                    { label: 'Kategori', value: pendingConfirm.categoryName, color: '#3a5c3a' },
                    { label: 'Akun', value: pendingConfirm.accountName, color: '#3a5c3a' },
                    { label: 'Tanggal', value: formatDate(pendingConfirm.date, 'dd MMM yyyy', lang), color: '#3a5c3a' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="font-mono text-[0.65rem] text-[#3a5c3a]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
                      <span className="font-mono text-[0.65rem] font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmTransaction(false)}
                    className="flex-1 matrix-btn matrix-btn-sm"
                    disabled={confirmLoading}
                  >
                    <X size={11} /> Batalkan
                  </button>
                  <button
                    onClick={() => handleConfirmTransaction(true)}
                    className="flex-1 matrix-btn matrix-btn-solid matrix-btn-sm"
                    disabled={confirmLoading}
                    style={{ opacity: confirmLoading ? 0.6 : 1 }}
                  >
                    <Check size={11} /> {confirmLoading ? 'Menyimpan...' : 'Ya, Catat'}
                  </button>
                </div>
              </NeonCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm result toast */}
        <AnimatePresence>
          {confirmResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`text-center font-mono text-xs py-2 ${confirmResult === 'success' ? 'text-[#00ff41]' : 'text-[#ff2055]'}`}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {confirmResult === 'success' ? '✓ Transaksi berhasil dicatat' : '✗ Gagal mencatat transaksi'}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT ── */}
      <motion.div
        className="px-4 pb-4 pt-2 shrink-0"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {/* Divider */}
        <div className="h-px mb-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.2), transparent)' }} />

        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#3a5c3a] text-sm pointer-events-none" style={{ fontFamily: 'JetBrains Mono, monospace' }}>&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Tanya ARIA tentang keuangan Anda..."
              className="matrix-input pl-7 pr-3 w-full"
              style={{ fontFamily: 'JetBrains Mono, monospace', opacity: isStreaming ? 0.6 : 1 }}
              autoComplete="off"
            />
          </div>
          <motion.button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="matrix-btn matrix-btn-solid matrix-btn-icon w-10 h-10 shrink-0"
            style={{ opacity: isStreaming || !input.trim() ? 0.4 : 1 }}
            whileTap={{ scale: 0.92 }}
          >
            {isStreaming ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RotateCcw size={14} />
              </motion.div>
            ) : (
              <Send size={14} />
            )}
          </motion.button>
        </div>

        <p className="text-[#1a3a1a] font-mono text-[0.55rem] text-center mt-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          ARIA dapat membuat kesalahan. Verifikasi keputusan keuangan penting dengan profesional.
        </p>
      </motion.div>
    </motion.div>
  )
}
