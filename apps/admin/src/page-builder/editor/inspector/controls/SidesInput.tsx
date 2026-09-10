import { useState } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
import { DimensionInput } from './DimensionInput'
import { sidesAreEqual } from '../dimension'
import type { StyleValue } from '../../core/types'
import { cn } from '../../../utils/cn'

export interface SidesInputProps {
  /** Style keys in visual order: top, right, bottom, left. */
  keys: readonly [string, string, string, string]
  values: readonly [string, string, string, string]
  onPatch: (patch: Record<string, StyleValue | null>) => void
}

const LABELS = ['T', 'R', 'B', 'L'] as const

/**
 * Four-side spacing editor with a link toggle.
 *
 * Linked mode writes all four keys in one patch, which matters for history:
 * one command means one undo step instead of four.
 */
export function SidesInput({ keys, values, onPatch }: SidesInputProps) {
  // Start linked when the sides already agree — otherwise linking would
  // silently discard three of the four existing values on first edit.
  const [linked, setLinked] = useState(() => sidesAreEqual(values))

  const write = (index: number, next: string | null) => {
    const key = keys[index]
    if (key === undefined) return
    if (!linked) {
      onPatch({ [key]: next })
      return
    }
    const patch: Record<string, StyleValue | null> = {}
    for (const key of keys) patch[key] = next
    onPatch(patch)
  }

  return (
    <div className="flex items-start gap-1.5">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
        {keys.map((key, index) => (
          <label key={key} className="flex min-w-0 items-center gap-1">
            <span className="w-3 shrink-0 text-[10px] font-medium text-slate-400">{LABELS[index]}</span>
            <span className="min-w-0 flex-1">
              <DimensionInput
                value={values[index] ?? ''}
                keywords={['auto']}
                onChange={(next) => write(index, next)}
              />
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        title={linked ? 'Sides linked — edits apply to all four' : 'Sides independent'}
        aria-pressed={linked}
        onClick={() => setLinked((current) => !current)}
        className={cn(
          'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border',
          linked
            ? 'border-brand-200 bg-brand-50 text-brand-600'
            : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600',
        )}
      >
        {linked ? <Link2 className="h-3 w-3" /> : <Unlink2 className="h-3 w-3" />}
      </button>
    </div>
  )
}
