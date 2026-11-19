import type { FindingSeverity } from '@/interfaces/FindingInterface'

const LOCALE = 'en-US'

const SEVERITY_TEXT_CLASS: Record<FindingSeverity, string> = {
  critical: 'text-critical',
  high: 'text-high',
  medium: 'text-medium',
  low: 'text-low',
}

export function formatDate(value: string | null | undefined, fallback: string = '-'): string {
  if (!value) return fallback
  return new Date(value).toLocaleDateString(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(value: string | null | undefined, fallback: string = '-'): string {
  if (!value) return fallback
  return new Date(value).toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Text color for a severity counter; zero counts are dimmed so non-zero values stand out. */
export function severityCountClass(count: number, severity: FindingSeverity): string {
  return count === 0 ? 'text-muted-foreground/40' : SEVERITY_TEXT_CLASS[severity]
}
