/**
 * Before / after viewer for patch values: strings, arrays, and objects.
 * Surfaces use theme tokens (`diff-old` / `diff-new`), not hardcoded hex.
 */
import { cn } from '../../utils/cn'

export interface DiffViewerProps {
  oldValue?: unknown
  newValue?: unknown
  action?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asText(value: unknown): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value === '' ? '(empty)' : value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function arrayDiff(oldValue: unknown[], newValue: unknown[]) {
  const oldKeys = oldValue.map((entry) => JSON.stringify(entry))
  const newKeys = newValue.map((entry) => JSON.stringify(entry))
  const removed = oldValue.filter((_, index) => !newKeys.includes(oldKeys[index] ?? ''))
  const added = newValue.filter((_, index) => !oldKeys.includes(newKeys[index] ?? ''))
  return { removed, added }
}

function objectDiff(oldValue: Record<string, unknown>, newValue: Record<string, unknown>) {
  const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])]
  return keys
    .filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
    .map((key) => ({ key, from: oldValue[key], to: newValue[key] }))
}

function isMovePayload(value: unknown): value is { from: number; to: number } {
  return isPlainObject(value) && typeof value['from'] === 'number' && typeof value['to'] === 'number'
}

export function DiffViewer({ oldValue, newValue, action }: DiffViewerProps) {
  const oldIsArray = Array.isArray(oldValue)
  const newIsArray = Array.isArray(newValue)
  const showArray = (oldIsArray || newIsArray) && action !== 'MOVE'
  const showObject = isPlainObject(oldValue) && isPlainObject(newValue) && !isMovePayload(newValue)
  const move = action === 'MOVE' && isMovePayload(newValue) ? newValue : null

  return (
    <div data-testid="diff-viewer" data-diff-action={action ?? 'UPDATE'} className="space-y-1.5 text-[11px]">
      {action === 'INSERT' || action === 'DELETE' || action === 'MOVE' ? (
        <p className="m-0 font-medium uppercase tracking-wide text-slate-400">{action}</p>
      ) : null}

      {move ? (
        <div className="space-y-1">
          <ValueBlock label="Before" tone="old" text={asText(oldValue)} />
          <ValueBlock label="After" tone="new" text={`Move index ${move.from} → ${move.to}`} />
        </div>
      ) : showArray ? (
        <ArrayBlock oldValue={oldIsArray ? oldValue : []} newValue={newIsArray ? newValue : []} />
      ) : showObject ? (
        <ObjectBlock oldValue={oldValue} newValue={newValue} />
      ) : (
        <div className="grid grid-cols-1 gap-1">
          <ValueBlock label="Before" tone="old" text={asText(oldValue)} />
          <ValueBlock label="After" tone="new" text={asText(newValue)} />
        </div>
      )}
    </div>
  )
}

function ValueBlock({ label, tone, text }: { label: string; tone: 'old' | 'new'; text: string }) {
  return (
    <div
      className={cn(
        'rounded-md px-2 py-1.5',
        tone === 'old' ? 'bg-diff-old-soft text-diff-old' : 'bg-diff-new-soft text-diff-new',
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <pre className="m-0 whitespace-pre-wrap break-words font-sans text-[11px] leading-snug">{text}</pre>
    </div>
  )
}

function ArrayBlock({ oldValue, newValue }: { oldValue: unknown[]; newValue: unknown[] }) {
  const { removed, added } = arrayDiff(oldValue, newValue)
  return (
    <div className="space-y-1">
      <ValueBlock label="Before" tone="old" text={asText(oldValue)} />
      <ValueBlock label="After" tone="new" text={asText(newValue)} />
      {removed.length > 0 ? (
        <p className="m-0 text-diff-old">Removed: {removed.map((entry) => asText(entry)).join(', ')}</p>
      ) : null}
      {added.length > 0 ? (
        <p className="m-0 text-diff-new">Added: {added.map((entry) => asText(entry)).join(', ')}</p>
      ) : null}
    </div>
  )
}

function ObjectBlock({
  oldValue,
  newValue,
}: {
  oldValue: Record<string, unknown>
  newValue: Record<string, unknown>
}) {
  const changes = objectDiff(oldValue, newValue)
  if (changes.length === 0) {
    return <ValueBlock label="Unchanged" tone="new" text={asText(newValue)} />
  }
  return (
    <ul className="m-0 space-y-1 p-0">
      {changes.map((change) => (
        <li key={change.key} className="rounded-md border border-shell-border p-1.5">
          <div className="mb-1 font-medium text-slate-600">{change.key}</div>
          <ValueBlock label="Before" tone="old" text={asText(change.from)} />
          <div className="h-1" />
          <ValueBlock label="After" tone="new" text={asText(change.to)} />
        </li>
      ))}
    </ul>
  )
}
