import type { ReactNode } from 'react'
import type { Device } from '../../core/types'
import { cn } from '../../../utils/cn'

/**
 * Where the value currently in the control comes from:
 * - `overridden` — this device layer declares it
 * - `inherited`  — a wider breakpoint declares it (`inheritedFrom`)
 * - `unset`      — nothing declares it; the browser default applies
 */
export type FieldState = 'overridden' | 'inherited' | 'unset'

interface FieldRowProps {
  label: string
  children: ReactNode
  state?: FieldState
  inheritedFrom?: Device | null
  onReset?: () => void
  /** Stack label above control (for wide inputs like textareas). */
  stacked?: boolean
  hint?: string
}

export function FieldRow({
  label,
  children,
  state = 'unset',
  inheritedFrom,
  onReset,
  stacked,
  hint,
}: FieldRowProps) {
  return (
    <div className={cn('py-1', stacked ? 'space-y-1' : 'flex items-start gap-2')}>
      <div
        className={cn(
          'flex items-center gap-1 pt-1 text-[11px]',
          state === 'overridden' ? 'text-slate-700' : 'text-slate-500',
          stacked ? '' : 'w-[86px] shrink-0',
        )}
      >
        <span className="truncate" title={label}>
          {label}
        </span>
        <StateMarker state={state} inheritedFrom={inheritedFrom} onReset={onReset} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {hint ? <span className="pt-1 text-[10px] text-slate-400">{hint}</span> : null}
    </div>
  )
}

function StateMarker({
  state,
  inheritedFrom,
  onReset,
}: Pick<FieldRowProps, 'state' | 'inheritedFrom' | 'onReset'>) {
  if (state === 'overridden') {
    return (
      <button
        type="button"
        aria-label="Reset this property"
        title="Overridden on this breakpoint — click to reset"
        onClick={onReset}
        className="h-2 w-2 shrink-0 rounded-full bg-brand-500 hover:ring-2 hover:ring-brand-200"
      />
    )
  }
  if (state === 'inherited') {
    return (
      <span
        aria-label={`Inherited from ${inheritedFrom ?? 'base'}`}
        title={`Inherited from ${inheritedFrom ?? 'base'}`}
        className="h-2 w-2 shrink-0 rounded-full border border-slate-300"
      />
    )
  }
  return null
}

/** Legend for the two markers, shown once per panel. */
export function FieldStateLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-slate-400">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-brand-500" /> Overridden
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full border border-slate-300" /> Inherited
      </span>
    </div>
  )
}
