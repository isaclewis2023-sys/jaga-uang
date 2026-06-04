'use client'

import { useEffect, useRef } from 'react'

const KATAKANA =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
const CHARS = KATAKANA + '0123456789ABCDEF$#@%&'

export default function MatrixRain({ opacity = 0.07 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const FONT_SIZE = 14
    let animId: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const columns = Math.floor(canvas.width / FONT_SIZE)
    const drops: number[] = Array(columns).fill(1)
    const speeds: number[] = Array(columns).fill(0).map(() => 0.3 + Math.random() * 0.7)
    const brightHead: boolean[] = Array(columns).fill(true)

    const draw = () => {
      ctx.fillStyle = `rgba(3, 3, 3, 0.05)`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < drops.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const y = drops[i] * FONT_SIZE

        if (brightHead[i]) {
          ctx.fillStyle = `rgba(220, 255, 220, ${opacity * 5})`
          ctx.font = `bold ${FONT_SIZE}px 'JetBrains Mono', monospace`
        } else {
          const fade = Math.max(0.1, 1 - drops[i] / (canvas.height / FONT_SIZE))
          ctx.fillStyle = `rgba(0, 180, 70, ${opacity * 4 * fade})`
          ctx.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`
        }

        ctx.fillText(char, i * FONT_SIZE, y)

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
          speeds[i] = 0.3 + Math.random() * 0.7
          brightHead[i] = Math.random() > 0.3
        }

        drops[i] += speeds[i]
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [opacity])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 1 }}
    />
  )
}
