'use client'

import { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface GlitchTextProps {
  text: string
  className?: string
  style?: CSSProperties
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'p'
  glow?: boolean
}

export default function GlitchText({
  text,
  className,
  style,
  tag: Tag = 'span',
  glow = true,
}: GlitchTextProps) {
  return (
    <Tag
      className={cn('glitch', glow && 'text-glow', className)}
      data-text={text}
      style={style}
    >
      {text}
    </Tag>
  )
}
