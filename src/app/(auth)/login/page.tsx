'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Terminal, Wifi } from 'lucide-react'
import MatrixRain from '@/components/matrix/MatrixRain'

type LoginState = 'idle' | 'scanning' | 'verifying' | 'granted' | 'denied'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [state, setState] = useState<LoginState>('idle')
  const [statusText, setStatusText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check if setup needed
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => {
        if (!d.setupComplete) router.replace('/setup')
      })
  }, [router])

  useEffect(() => {
    if (state === 'idle') inputRef.current?.focus()
  }, [state])

  const typeStatus = (text: string, cb?: () => void) => {
    setStatusText('')
    let i = 0
    const interval = setInterval(() => {
      setStatusText(text.slice(0, i + 1))
      i++
      if (i >= text.length) {
        clearInterval(interval)
        cb?.()
      }
    }, 28)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || state !== 'idle') return

    setState('scanning')
    typeStatus('> MEMINDAI IDENTITAS...', () => {
      setState('verifying')
      typeStatus('> MEMVERIFIKASI KREDENSIAL...', async () => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          })
          const data = await res.json()

          if (res.ok) {
            setState('granted')
            typeStatus('> AKSES DIBERIKAN — SELAMAT DATANG', () => {
              setTimeout(() => router.push('/'), 600)
            })
          } else {
            setState('denied')
            typeStatus(`> AKSES DITOLAK: ${data.error?.toUpperCase() ?? 'PASSWORD SALAH'}`, () => {
              setTimeout(() => {
                setState('idle')
                setPassword('')
                setStatusText('')
              }, 1500)
            })
          }
        } catch {
          setState('denied')
          typeStatus('> ERROR: KONEKSI GAGAL', () => {
            setTimeout(() => { setState('idle'); setStatusText('') }, 1500)
          })
        }
      })
    })
  }

  const statusColor =
    state === 'granted' ? '#00ff41' :
    state === 'denied' ? '#ff2055' :
    '#00b347'

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-[#030303]">
      <MatrixRain opacity={0.09} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center gap-8">
        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Terminal size={18} className="text-[#00ff41]" style={{ filter: 'drop-shadow(0 0 6px #00ff41)' }} />
            <span
              className="text-[#00b347] font-mono text-xs tracking-[0.25em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              SISTEM KEUANGAN PRIBADI v2.0
            </span>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#00b347] animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>

          <h1
            className="glitch text-4xl sm:text-5xl font-bold text-[#00ff41] text-glow tracking-tight"
            data-text="JAGA UANG"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            JAGA UANG
          </h1>
          <p
            className="text-[#3a5c3a] text-xs tracking-[0.3em] uppercase mt-2"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            ── FINANCIAL TERMINAL ──
          </p>
        </motion.div>

        {/* Login panel */}
        <motion.div
          className="w-full matrix-panel glow-box p-6"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[rgba(0,255,65,0.1)]">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff2055] opacity-80" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffd700] opacity-80" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#00ff41] opacity-80" />
            </div>
            <span
              className="text-[#3a5c3a] font-mono text-xs ml-2 tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              terminal@jaga-uang:~$
            </span>
            <Wifi size={10} className="ml-auto text-[#00b347] animate-pulse" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="matrix-label">
                &gt; MASUKKAN KODE AKSES
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="matrix-input pr-10"
                  placeholder="••••••••"
                  disabled={state !== 'idle'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a5c3a] hover:text-[#00b347] transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Status display */}
            <AnimatePresence mode="wait">
              {statusText && (
                <motion.div
                  key={statusText}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="font-mono text-xs py-2 px-3 rounded border"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: statusColor,
                      borderColor: `${statusColor}33`,
                      background: `${statusColor}08`,
                    }}
                  >
                    <span>{statusText}</span>
                    {(state === 'scanning' || state === 'verifying') && (
                      <span className="cursor-blink" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              className="matrix-btn matrix-btn-solid w-full"
              disabled={state !== 'idle' || !password}
              whileTap={{ scale: 0.97 }}
              style={{ opacity: (state !== 'idle' || !password) ? 0.45 : 1 }}
            >
              {state === 'idle' ? '> AKSES TERMINAL' :
               state === 'scanning' ? '> MEMINDAI...' :
               state === 'verifying' ? '> VERIFIKASI...' :
               state === 'granted' ? '> SELAMAT DATANG' :
               '> MENCOBA LAGI...'}
            </motion.button>
          </form>

          <div className="mt-4 pt-3 border-t border-[rgba(0,255,65,0.08)]">
            <p
              className="text-center text-[#3a5c3a] font-mono"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}
            >
              [PRIVATE ACCESS ONLY] · END-TO-END ENCRYPTED
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-[#1e3a1e] font-mono text-center"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          JAGA UANG © {new Date().getFullYear()} · ALL SYSTEMS NOMINAL
        </motion.p>
      </div>
    </div>
  )
}
