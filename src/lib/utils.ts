import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { id as localeId, enUS } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000
    return `Rp ${millions.toFixed(1)}jt`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string, fmt = 'dd MMM yyyy', locale: 'id' | 'en' = 'id'): string {
  try {
    return format(parseISO(date), fmt, { locale: locale === 'id' ? localeId : enUS })
  } catch {
    return date
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function getMonthStart(year?: number, month?: number): string {
  const d = new Date()
  const y = year ?? d.getFullYear()
  const m = (month ?? d.getMonth() + 1) - 1
  return new Date(y, m, 1).toISOString().split('T')[0]
}

export function getMonthEnd(year?: number, month?: number): string {
  const d = new Date()
  const y = year ?? d.getFullYear()
  const m = (month ?? d.getMonth() + 1) - 1
  return new Date(y, m + 1, 0).toISOString().split('T')[0]
}

export function addMonths(date: string, months: number): string {
  const d = parseISO(date)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export function getDaysRemaining(deadline: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseISO(deadline)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getProgressPercentage(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

export function getHealthColor(score: number): string {
  if (score >= 80) return '#00ff41'
  if (score >= 61) return '#00b347'
  if (score >= 41) return '#ffd700'
  return '#ff2055'
}

export function getHealthLabel(score: number): string {
  if (score >= 80) return 'EXCELLENT'
  if (score >= 61) return 'GOOD'
  if (score >= 41) return 'WARNING'
  return 'CRITICAL'
}

export const ACCOUNT_ICONS: Record<string, string> = {
  bank: '🏦',
  cash: '💵',
  savings: '🏧',
  investment: '📈',
  credit: '💳',
}

export const DEFAULT_CATEGORIES = [
  { name: 'Gaji', type: 'income', color: '#00ff41', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#00b347', icon: '💻' },
  { name: 'Investasi', type: 'income', color: '#00e5ff', icon: '📈' },
  { name: 'Bonus', type: 'income', color: '#a8ff78', icon: '🎁' },
  { name: 'Lain-lain (Masuk)', type: 'income', color: '#78ffd6', icon: '➕' },
  { name: 'Makan & Minum', type: 'expense', color: '#ff6b6b', icon: '🍽️' },
  { name: 'Transportasi', type: 'expense', color: '#ffd700', icon: '🚗' },
  { name: 'Belanja', type: 'expense', color: '#ff9f43', icon: '🛒' },
  { name: 'Tagihan & Utilitas', type: 'expense', color: '#ee5a24', icon: '🔌' },
  { name: 'Kesehatan', type: 'expense', color: '#ff6b81', icon: '🏥' },
  { name: 'Hiburan', type: 'expense', color: '#a29bfe', icon: '🎮' },
  { name: 'Pendidikan', type: 'expense', color: '#74b9ff', icon: '📚' },
  { name: 'Langganan', type: 'expense', color: '#fd79a8', icon: '📱' },
  { name: 'Lain-lain (Keluar)', type: 'expense', color: '#b2bec3', icon: '➖' },
]
