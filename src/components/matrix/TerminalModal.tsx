'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerminalModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
  footer?: React.ReactNode
}

export default function TerminalModal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  footer,
}: TerminalModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className={cn(
              'relative w-full z-10',
              maxWidth,
              'matrix-panel glow-box',
              'flex flex-col max-h-[90dvh]'
            )}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,255,65,0.12)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#00b347] font-mono text-xs">▶</span>
                <span
                  className="font-mono text-sm font-semibold tracking-wider uppercase text-[#00ff41]"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {title}
                </span>
              </div>
              <button
                onClick={onClose}
                className="matrix-btn matrix-btn-icon matrix-btn-sm opacity-60 hover:opacity-100"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-4 py-3 border-t border-[rgba(0,255,65,0.12)] shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
