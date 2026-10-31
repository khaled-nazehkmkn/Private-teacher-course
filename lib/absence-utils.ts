export interface AbsenceBadgeConfig {
  consecutiveLimit?: number
  totalLimit?: number
}

export type AbsenceSeverity = 'green' | 'yellow' | 'orange' | 'red'

export function getAbsenceSeverity(
  absentCount: number,
  consecutiveCount: number = 0,
  limits: AbsenceBadgeConfig = { consecutiveLimit: 2, totalLimit: 3 }
): {
  severity: AbsenceSeverity
  isAlert: boolean
  label: string
  bgClass: string
  textClass: string
  borderClass: string
} {
  const isAlert =
    (limits.totalLimit && absentCount >= limits.totalLimit) ||
    (limits.consecutiveLimit && consecutiveCount >= limits.consecutiveLimit)

  if (absentCount <= 1) {
    return {
      severity: 'green',
      isAlert: false,
      label: 'منتظم',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      borderClass: 'border-emerald-200 dark:border-emerald-800',
    }
  }

  if (absentCount <= 3) {
    return {
      severity: 'yellow',
      isAlert: Boolean(isAlert),
      label: 'تنبيه غياب',
      bgClass: 'bg-amber-50 dark:bg-amber-950/40',
      textClass: 'text-amber-700 dark:text-amber-400',
      borderClass: 'border-amber-200 dark:border-amber-800',
    }
  }

  if (absentCount === 4) {
    return {
      severity: 'orange',
      isAlert: true,
      label: 'غياب متكرر',
      bgClass: 'bg-orange-50 dark:bg-orange-950/40',
      textClass: 'text-orange-700 dark:text-orange-400',
      borderClass: 'border-orange-200 dark:border-orange-800',
    }
  }

  return {
    severity: 'red',
    isAlert: true,
    label: 'خطر انقطاع',
    bgClass: 'bg-rose-50 dark:bg-rose-950/40',
    textClass: 'text-rose-700 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-800',
  }
}
