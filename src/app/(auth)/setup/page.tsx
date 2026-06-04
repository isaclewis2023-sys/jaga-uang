'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Terminal } from 'lucide-react'
import MatrixRain from '@/components/matrix/MatrixRain'

export default function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => { if (d.setupComplete) router.replace('/login') })
  }, [router])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('Password minimal 8 karakter'); return }
    if (password !== confirm) { setError('Password tidak cocok'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Gagal'); return }
      setDone(true)
      setTimeout(() => router.replace('/login'), 2000)
    } catch {
      setError('Koneksi gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-[#030303]">
      <MatrixRain opacity={0.07} />

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center gap-8">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Terminal size={16} className="text-[#00ff41]" />
            <span className="text-[#00b347] font-mono text-xs tracking-widest uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              INISIALISASI SISTEM
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[#00ff41] text-glow tracking-tight"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            JAGA UANG
          </h1>
          <p className="text-[#3a5c3a] text-xs tracking-widest uppercase mt-1 font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            SETUP PERTAMA KALI
          </p>
        </motion.div>

        <motion.div
          className="w-full matrix-panel glow-box p-6"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <div className="mb-5">
            <p className="text-[#c8ffc8] text-sm font-mono mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              &gt; Buat password untuk mengamankan terminal keuangan Anda.
            </p>
            <p className="text-[#3a5c3a] text-xs font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              Password ini satu-satunya cara mengakses sistem.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-4"
              >
                <ShieldCheck size={36} className="text-[#00ff41] text-glow" />
                <p className="font-mono text-[#00ff41] text-glow font-semibold tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  SISTEM TERINISIALISASI
                </p>
                <p className="text-[#3a5c3a] font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  Mengalihkan ke login...
                </p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label className="matrix-label">&gt; PASSWORD BARU</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="matrix-input"
                    placeholder="Min. 8 karakter"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="matrix-label">&gt; KONFIRMASI PASSWORD</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="matrix-input"
                    placeholder="Ulangi password"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-mono text-xs text-[#ff2055] text-glow-red"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    &gt; ERROR: {error.toUpperCase()}
                  </motion.p>
                )}

                <button
                  type="submit"
                  className="matrix-btn matrix-btn-solid w-full"
                  disabled={loading || !password || !confirm}
                  style={{ opacity: (loading || !password || !confirm) ? 0.45 : 1 }}
                >
                  {loading ? '> MENGINISIALISASI...' : '> INISIALISASI SISTEM'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
