'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface NeonCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  animate?: boolean
  delay?: number
  onClick?: () => void
}

export default function NeonCard({
  children,
  className,
  hover = true,
  glow = false,
  animate = true,
  delay = 0,
  onClick,
}: NeonCardProps) {
  const base = (
    <div
      className={cn(
        'matrix-card',
        hover && 'glow-box-hover cursor-default',
        glow && 'glow-box',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )

  if (!animate) return base

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={cn(
        'matrix-card',
        hover && 'glow-box-hover',
        glow && 'glow-box',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {children}
    </motion.div>
  )
}
