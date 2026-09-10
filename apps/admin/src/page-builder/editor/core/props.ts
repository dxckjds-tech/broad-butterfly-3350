/**
 * Typed accessors over `EditorNode.props` (which is deliberately
 * `Record<string, unknown>` so the document stays serialisable and
 * forward-compatible). Renderers and inspectors read props through here.
 */

export function getString(props: Record<string, unknown>, key: string, fallback = ''): string {
  const value = props[key]
  return typeof value === 'string' ? value : fallback
}

export function getNumber(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function getBoolean(props: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = props[key]
  return typeof value === 'boolean' ? value : fallback
}

export function getStringArray(props: Record<string, unknown>, key: string): string[] {
  const value = props[key]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/** Constrain a value to a known union, falling back when the document is stale. */
export function getEnum<T extends string>(
  props: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = props[key]
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}
