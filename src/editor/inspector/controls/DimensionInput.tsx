import { useMemo } from 'react'
import { KEYWORD_UNITS, LENGTH_UNITS, formatDimension, parseDimension } from '../dimension'
import type { DimensionUnit, LengthUnit } from '../dimension'
import { TextInput } from './inputs'
import { useEditTransaction } from '../../hooks/useEditTransaction'
import { cn } from '../../../utils/cn'

export interface DimensionInputProps {
  value: string
  onChange: (value: string | null) => void
  /** Keyword units offered alongside the lengths, e.g. `auto` for width. */
  keywords?: readonly DimensionUnit[]
  fallbackUnit?: LengthUnit
  placeholder?: string
}

/**
 * Amount + unit editor for CSS lengths.
 *
 * Values it cannot represent (`calc()`, `min-content`, shorthands) degrade
 * to a plain text field rather than being rewritten — the document may hold
 * anything CSS accepts, and the inspector must not corrupt it.
 */
export function DimensionInput({
  value,
  onChange,
  keywords = [],
  fallbackUnit = 'px',
  placeholder,
}: DimensionInputProps) {
  const parsed = useMemo(() => parseDimension(value, fallbackUnit), [value, fallbackUnit])
  const transaction = useEditTransaction()

  if (!parsed) {
    return <TextInput value={value} placeholder={placeholder} onChange={(next) => onChange(next === '' ? null : next)} />
  }

  const units: readonly DimensionUnit[] = [...LENGTH_UNITS, ...keywords]
  const isKeyword = (KEYWORD_UNITS as readonly string[]).includes(parsed.unit)

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={isKeyword ? '' : parsed.amount}
        disabled={isKeyword}
        placeholder={isKeyword ? parsed.unit : placeholder}
        onFocus={transaction.onEditStart}
        onBlur={transaction.onEditEnd}
        onChange={(event) => onChange(formatDimension({ amount: event.target.value, unit: parsed.unit }))}
        className={cn(
          'min-w-0 flex-1 rounded-md border border-slate-200 px-1.5 py-1 text-[11px] tabular-nums',
          'focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200',
          isKeyword && 'bg-slate-50 text-slate-400',
        )}
      />
      <select
        value={parsed.unit}
        aria-label="Unit"
        onChange={(event) => {
          const unit = event.target.value as DimensionUnit
          onChange(formatDimension({ amount: parsed.amount, unit }))
        }}
        className="w-[52px] shrink-0 rounded-md border border-slate-200 bg-white px-1 py-1 text-[11px] text-slate-600 focus:border-brand-400 focus:outline-none"
      >
        {units.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </div>
  )
}
