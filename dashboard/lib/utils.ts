export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function severityBadgeClass(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return 'badge badge-critical'
    case 'high':     return 'badge badge-high'
    case 'medium':   return 'badge badge-medium'
    case 'low':      return 'badge badge-low'
    default:         return 'badge badge-gray'
  }
}

export function resolutionBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'resolved':           return 'badge badge-green'
    case 'unresolved':         return 'badge badge-critical'
    case 'partially resolved': return 'badge badge-high'
    default:                   return 'badge badge-gray'
  }
}

export function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':      return 'badge badge-critical'
    case 'in review': return 'badge badge-amber'
    case 'closed':    return 'badge badge-green'
    default:          return 'badge badge-gray'
  }
}

export function scoreColor(score: number): string {
  if (score >= 4.5) return 'var(--green)'
  if (score >= 3.5) return 'var(--low)'
  if (score >= 2.5) return 'var(--medium)'
  if (score >= 1.5) return 'var(--high)'
  return 'var(--critical)'
}

export function truncate(str: string, max = 80): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
