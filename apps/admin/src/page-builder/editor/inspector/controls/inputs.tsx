import type { ChangeEvent } from 'react'
import { useEditTransaction } from '../../hooks/useEditTransaction'
import { cn } from '../../../utils/cn'

const base =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TextInput({ value, onChange, placeholder, className }: TextInputProps) {
  const { onEditStart, onEditEnd } = useEditTransaction('text')
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onFocus={onEditStart}
      onBlur={onEditEnd}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      className={cn(base, className)}
    />
  )
}

interface TextAreaProps extends TextInputProps {
  rows?: number
}

export function TextArea({ value, onChange, placeholder, rows = 4, className }: TextAreaProps) {
  const { onEditStart, onEditEnd } = useEditTransaction('text')
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onFocus={onEditStart}
      onBlur={onEditEnd}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      className={cn(base, 'resize-y leading-relaxed', className)}
    />
  )
}

interface NumberInputProps {
  value: number | ''
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export function NumberInput({ value, onChange, min, max, step, placeholder }: NumberInputProps) {
  const { onEditStart, onEditEnd } = useEditTransaction('number')
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onFocus={onEditStart}
      onBlur={onEditEnd}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value
        onChange(raw === '' ? null : Number(raw))
      }}
      className={base}
    />
  )
}

export interface SelectOption {
  label: string
  value: string
}

interface SelectInputProps {
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  /** Label for the "not set" entry. */
  emptyLabel?: string
}

export function SelectInput({ value, options, onChange, emptyLabel = '—' }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      className={cn(base, 'cursor-pointer')}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

interface ColorInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ColorInput({ value, onChange, placeholder = 'transparent' }: ColorInputProps) {
  const swatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : '#ffffff'
  const { onEditStart, onEditEnd } = useEditTransaction('colour')
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={swatch}
        // A native colour picker streams changes while dragging — one entry.
        onPointerDown={onEditStart}
        onBlur={onEditEnd}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        aria-label="Pick colour"
        className="h-6 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
      />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={onEditStart}
        onBlur={onEditEnd}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        className={cn(base, 'font-mono')}
      />
    </div>
  )
}

export interface SegmentedOption<T extends string> {
  label: string
  value: T
  title?: string
}

interface SegmentedInputProps<T extends string> {
  value: T | ''
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
}

export function SegmentedInput<T extends string>({
  value,
  options,
  onChange,
}: SegmentedInputProps<T>) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 px-1.5 py-1 text-[11px] transition-colors',
            option.value === value
              ? 'bg-brand-50 font-medium text-brand-600'
              : 'bg-white text-slate-500 hover:bg-slate-50',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
