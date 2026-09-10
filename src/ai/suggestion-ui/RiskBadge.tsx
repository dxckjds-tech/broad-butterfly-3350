/**
 * Risk chip. Colours come from `@theme` tokens in `index.css`, not hex literals.
 */
import type { SuggestionRisk } from '../protocol/suggestion'
import { cn } from '../../utils/cn'

const COPY: Record<SuggestionRisk, string> = {
  LOW: '普通优化',
  MEDIUM: '需要注意',
  HIGH: '必须确认',
}

const TONE: Record<SuggestionRisk, string> = {
  LOW: 'bg-risk-low-soft text-risk-low',
  MEDIUM: 'bg-risk-medium-soft text-risk-medium',
  HIGH: 'bg-risk-high-soft text-risk-high',
}

export function RiskBadge({ risk }: { risk: SuggestionRisk }) {
  return (
    <span
      data-testid="risk-badge"
      data-risk={risk}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        TONE[risk],
      )}
    >
      {risk} · {COPY[risk]}
    </span>
  )
}
