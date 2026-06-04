'use client'

import { useEffect, useRef, useState } from 'react'
import { formatIDR } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface CounterNumberProps {
  value: number
  duration?: number
  currency?: boolean
  className?: string
  compact?: boolean
  prefix?: string
  suffix?: string
  decimals?: number
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function CounterNumber({
  value,
  duration = 1200,
  currency = false,
  className,
  compact = false,
  prefix = '',
  suffix = '',
  decimals = 0,
}: CounterNumberProps) {
  const [displayed, setDisplayed] = useState(0)
  const prevRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const startValue = prevRef.current
    const endValue = value

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOut(progress)
      const current = startValue + (endValue - startValue) * eased
      setDisplayed(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = endValue
        startRef.current = null
      }
    }

    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    rafRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  const formatted = currency
    ? formatIDR(displayed, compact)
    : decimals > 0
    ? displayed.toFixed(decimals)
    : Math.round(displayed).toLocaleString('id-ID')

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
