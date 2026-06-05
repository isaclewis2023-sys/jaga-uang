'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'

export type FaceExpression = 'idle' | 'thinking' | 'talking' | 'happy' | 'sad' | 'surprised' | 'warning'

interface AriaFaceProps {
  expression: FaceExpression
  isTalking: boolean
}

export default function AriaFace({ expression, isTalking }: AriaFaceProps) {
  const [blinkState, setBlinkState] = useState(false)
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 })
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dartTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Natural blink loop
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 3000
      blinkTimer.current = setTimeout(() => {
        setBlinkState(true)
        setTimeout(() => setBlinkState(false), 120)
        scheduleBlink()
      }, delay)
    }
    scheduleBlink()
    return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current) }
  }, [])

  // Eye darting when thinking
  useEffect(() => {
    if (expression !== 'thinking') { setPupilPos({ x: 0, y: 0 }); return }
    const dart = () => {
      setPupilPos({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 4 })
      dartTimer.current = setTimeout(dart, 400 + Math.random() * 600)
    }
    dart()
    return () => { if (dartTimer.current) clearTimeout(dartTimer.current) }
  }, [expression])

  const isHappy = expression === 'happy'
  const isSad = expression === 'sad'
  const isSurprised = expression === 'surprised'
  const isWarning = expression === 'warning'
  const isThinking = expression === 'thinking'

  const eyeScaleY = blinkState ? 0.05 : isSurprised ? 1.3 : isWarning ? 0.7 : 1
  const eyeScaleX = isSurprised ? 1.2 : 1
  const browY = isHappy ? 2 : isSad ? -3 : isWarning ? -4 : isThinking ? -2 : 0
  const browRotate = isSad ? 8 : isWarning ? -10 : isThinking ? -5 : 0

  const getMouthPath = () => {
    if (isTalking) {
      const openAmount = 4 + Math.random() * 3
      return `M 62 102 Q 80 ${102 + openAmount} 98 102`
    }
    if (isHappy) return 'M 60 100 Q 80 116 100 100'
    if (isSad) return 'M 60 108 Q 80 96 100 108'
    if (isSurprised) return 'M 70 100 Q 80 110 90 100 Q 80 118 70 100'
    if (isWarning) return 'M 62 104 Q 80 100 98 104'
    return 'M 64 103 Q 80 110 96 103'
  }

  // Amber for normal/happy/talking, red for warning, cyan for sad
  const accentColor = isWarning ? '#ff2055' : isSad ? '#00e5ff' : '#FFB000'
  const glowColor   = isWarning ? 'rgba(255,32,85,0.4)' : isSad ? 'rgba(0,229,255,0.3)' : 'rgba(255,176,0,0.40)'

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 200, height: 240 }}>

      {/* ── CRT MONITOR FRAME ── */}
      <div className="relative" style={{
        width: 196,
        height: 236,
        background: '#0D0B00',
        border: '2px solid #4A3800',
        borderRadius: '6px',
        boxShadow: '0 0 0 1px #2A2000, 0 4px 28px rgba(0,0,0,0.85)',
      }}>

        {/* Corner brackets */}
        <svg style={{ position: 'absolute', top: 5, left: 5, width: 14, height: 14 }} viewBox="0 0 14 14" fill="none">
          <path d="M 13 1 L 1 1 L 1 13" stroke={accentColor} strokeWidth="1.5" strokeLinecap="square" strokeOpacity="0.8"/>
        </svg>
        <svg style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14 }} viewBox="0 0 14 14" fill="none">
          <path d="M 1 1 L 13 1 L 13 13" stroke={accentColor} strokeWidth="1.5" strokeLinecap="square" strokeOpacity="0.8"/>
        </svg>
        <svg style={{ position: 'absolute', bottom: 5, left: 5, width: 14, height: 14 }} viewBox="0 0 14 14" fill="none">
          <path d="M 13 13 L 1 13 L 1 1" stroke={accentColor} strokeWidth="1.5" strokeLinecap="square" strokeOpacity="0.8"/>
        </svg>
        <svg style={{ position: 'absolute', bottom: 5, right: 5, width: 14, height: 14 }} viewBox="0 0 14 14" fill="none">
          <path d="M 1 13 L 13 13 L 13 1" stroke={accentColor} strokeWidth="1.5" strokeLinecap="square" strokeOpacity="0.8"/>
        </svg>

        {/* Bezel top label */}
        <div style={{
          position: 'absolute', top: 7, left: 0, right: 0,
          textAlign: 'center', zIndex: 20,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.48rem', letterSpacing: '0.2em',
          color: '#806000', textTransform: 'uppercase',
        }}>
          ARIA v3.0
        </div>

        {/* Screen area */}
        <div className="absolute aria-crt-flicker" style={{
          top: 22, left: 8, right: 8, bottom: 32,
          background: '#060400',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>

          {/* Phosphor glow border — replaces old outer glow ring */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              boxShadow: isTalking
                ? [`0 0 20px ${glowColor}`, `0 0 40px ${glowColor}`, `0 0 20px ${glowColor}`]
                : [`0 0 10px ${glowColor}`, `0 0 22px ${glowColor}`, `0 0 10px ${glowColor}`],
            }}
            transition={{ duration: isTalking ? 0.35 : 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ zIndex: 1, borderRadius: 3 }}
          />

          {/* Phosphor bloom radial */}
          <div className="absolute inset-0 pointer-events-none" style={{
            zIndex: 2,
            background: `radial-gradient(ellipse at 50% 48%, ${isWarning ? 'rgba(255,32,85,0.06)' : isSad ? 'rgba(0,229,255,0.06)' : 'rgba(255,176,0,0.06)'} 0%, transparent 70%)`,
          }} />

          {/* Scanlines — heavier than global body scanlines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            zIndex: 10,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0.22) 4px)',
          }} />

          {/* Face SVG — all expressions unchanged */}
          <motion.svg
            width="180" height="192"
            viewBox="0 0 160 180"
            style={{
              position: 'relative', zIndex: 3,
              filter: `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 0 3px ${glowColor})`,
            }}
          >
            <defs>
              <radialGradient id="ariaFaceGrad" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor={isWarning ? '#1a0005' : isSad ? '#001a1a' : '#100a00'} />
                <stop offset="100%" stopColor={isWarning ? '#000800' : isSad ? '#000800' : '#0a0800'} />
              </radialGradient>
              <radialGradient id="ariaEyeGrad" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0.4" />
              </radialGradient>
              <filter id="ariaSoftGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <clipPath id="ariaFaceClip">
                <ellipse cx="80" cy="88" rx="68" ry="78" />
              </clipPath>
            </defs>

            {/* Face base */}
            <ellipse cx="80" cy="88" rx="68" ry="78" fill="url(#ariaFaceGrad)" stroke={accentColor} strokeWidth="1" strokeOpacity="0.4" />

            {/* Temple circuit lines */}
            <g stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.2" fill="none">
              <path d="M 18 70 L 28 70 L 32 65 L 40 65" />
              <path d="M 18 85 L 25 85 L 28 80" />
              <path d="M 142 70 L 132 70 L 128 65 L 120 65" />
              <path d="M 142 85 L 135 85 L 132 80" />
            </g>

            {/* Forehead subtle line */}
            <line x1="60" y1="22" x2="100" y2="22" stroke={accentColor} strokeWidth="0.4" strokeOpacity="0.15" />

            {/* LEFT EYE */}
            <g style={{
              transform: `scaleY(${eyeScaleY}) scaleX(${eyeScaleX})`,
              transformOrigin: '52px 72px',
              transition: `transform ${blinkState ? 0.06 : 0.15}s ease-out`,
            }}>
              <ellipse cx="52" cy="72" rx="16" ry="12" fill="rgba(0,0,0,0.6)" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.5" />
              <ellipse
                cx={52 + pupilPos.x} cy={72 + pupilPos.y}
                rx={isSurprised ? 11 : 10} ry={isSurprised ? 9 : 8}
                fill="url(#ariaEyeGrad)"
                filter="url(#ariaSoftGlow)"
              />
              <circle
                cx={52 + pupilPos.x} cy={72 + pupilPos.y}
                r={isThinking ? 3 : isSurprised ? 5 : 4}
                fill="rgba(0,0,0,0.8)"
              />
              <circle cx={54 + pupilPos.x} cy={70 + pupilPos.y} r="1.5" fill="white" fillOpacity="0.7" />
              <line x1="38" y1="80" x2="66" y2="80" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.3" />
            </g>

            {/* Left eyebrow */}
            <motion.g
              animate={{ y: browY, rotate: browRotate }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ transformOrigin: '52px 56px' }}
            >
              <path
                d={isSad ? 'M 36 55 Q 52 60 68 57' : isWarning ? 'M 36 52 Q 52 56 68 60' : isThinking ? 'M 36 54 Q 52 50 68 53' : isHappy ? 'M 36 56 Q 52 50 68 54' : 'M 36 57 Q 52 52 68 55'}
                fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8"
              />
            </motion.g>

            {/* RIGHT EYE */}
            <g style={{
              transform: `scaleY(${eyeScaleY}) scaleX(${eyeScaleX})`,
              transformOrigin: '108px 72px',
              transition: `transform ${blinkState ? 0.06 : 0.15}s ease-out`,
            }}>
              <ellipse cx="108" cy="72" rx="16" ry="12" fill="rgba(0,0,0,0.6)" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.5" />
              <ellipse
                cx={108 + pupilPos.x} cy={72 + pupilPos.y}
                rx={isSurprised ? 11 : 10} ry={isSurprised ? 9 : 8}
                fill="url(#ariaEyeGrad)"
                filter="url(#ariaSoftGlow)"
              />
              <circle
                cx={108 + pupilPos.x} cy={72 + pupilPos.y}
                r={isThinking ? 3 : isSurprised ? 5 : 4}
                fill="rgba(0,0,0,0.8)"
              />
              <circle cx={110 + pupilPos.x} cy={70 + pupilPos.y} r="1.5" fill="white" fillOpacity="0.7" />
              <line x1="94" y1="80" x2="122" y2="80" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.3" />
            </g>

            {/* Right eyebrow */}
            <motion.g
              animate={{ y: browY, rotate: -browRotate }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ transformOrigin: '108px 56px' }}
            >
              <path
                d={isSad ? 'M 92 57 Q 108 60 124 55' : isWarning ? 'M 92 60 Q 108 56 124 52' : isThinking ? 'M 92 53 Q 108 50 124 54' : isHappy ? 'M 92 54 Q 108 50 124 56' : 'M 92 55 Q 108 52 124 57'}
                fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8"
              />
            </motion.g>

            {/* NOSE */}
            <motion.path
              d="M 80 80 L 74 96 Q 80 99 86 96 L 80 80"
              fill="none" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.35"
              strokeLinecap="round" strokeLinejoin="round"
            />

            {/* MOUTH */}
            <path
              d={getMouthPath()}
              fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round"
              filter="url(#ariaSoftGlow)"
            />

            {/* Mouth inner — open when talking */}
            <AnimatePresence>
              {isTalking && (
                <motion.ellipse
                  cx="80" cy="106" rx="10" ry="4"
                  fill="rgba(0,0,0,0.7)"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  exit={{ scaleY: 0 }}
                  style={{ transformOrigin: '80px 106px' }}
                  transition={{ duration: 0.08 }}
                />
              )}
            </AnimatePresence>

            {/* Cheek blush (happy) */}
            <AnimatePresence>
              {isHappy && (
                <>
                  <motion.ellipse
                    cx="36" cy="90" rx="12" ry="7"
                    fill={accentColor} fillOpacity="0.08"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.ellipse
                    cx="124" cy="90" rx="12" ry="7"
                    fill={accentColor} fillOpacity="0.08"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.3 }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Thinking dots */}
            <AnimatePresence>
              {isThinking && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.circle
                      key={i}
                      cx={68 + i * 12} cy={145} r={3}
                      fill={accentColor}
                      animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }}
                    />
                  ))}
                </motion.g>
              )}
            </AnimatePresence>

            {/* Warning indicator */}
            <AnimatePresence>
              {isWarning && (
                <motion.text
                  x="80" y="150"
                  textAnchor="middle"
                  fill="#ff2055"
                  fontSize="14"
                  fontFamily="JetBrains Mono, monospace"
                  filter="url(#ariaSoftGlow)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ⚠
                </motion.text>
              )}
            </AnimatePresence>

            {/* Bottom data line */}
            <line
              x1="30" y1="168" x2="130" y2="168"
              stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.3"
            />
          </motion.svg>

        </div>{/* end screen area */}

        {/* Bezel bottom: signal bars + status */}
        <div style={{
          position: 'absolute', bottom: 6, left: 12, right: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 20,
        }}>
          {/* Signal bars — 4 bars, varying heights */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            {[5, 8, 11, 14].map((h, i) => (
              <motion.div
                key={i}
                style={{ width: 3, height: h, background: accentColor, borderRadius: 1 }}
                animate={{ opacity: [0.7, 0.35, 0.7] }}
                transition={{ duration: 1.5 + i * 0.3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
              />
            ))}
          </div>

          {/* Status text */}
          <motion.span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.45rem', letterSpacing: '0.12em',
              color: accentColor, textTransform: 'uppercase',
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {expression === 'thinking' ? 'MEMPROSES...' : expression === 'warning' ? 'PERHATIAN' : 'ARIA ONLINE'}
          </motion.span>
        </div>

      </div>{/* end monitor frame */}
    </div>
  )
}
