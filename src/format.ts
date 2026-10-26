import type { BillingPeriod, Level } from './types'

const number = new Intl.NumberFormat('en-US')
export const count = (n: number) => number.format(n)

export const levelName: Record<Level, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

export function price(cents: number, currency: string, period?: BillingPeriod) {
  if (cents === 0) return 'Free'
  let amount: string
  try {
    amount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
  } catch {
    amount = `${(cents / 100).toFixed(2)} ${currency}`
  }
  return period ? `${amount} / ${period === 'MONTHLY' ? 'month' : 'year'}` : amount
}

export const voiceMinutes = (seconds: number) => {
  const minutes = seconds / 60
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

/** ISO timestamps and plain `YYYY-MM-DD` days; days are shown as written, without shifting time zones. */
export function date(value: string, short = false) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return (short ? shortDate : dateFormat).format(parsed)
}

/** "Today", "Yesterday", "5 days ago", then a date. */
export function lastActive(day?: string) {
  if (!day) return 'Never'
  const then = new Date(`${day}T12:00:00`)
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date(day)
}
