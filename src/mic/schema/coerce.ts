/**
 * Tiny unknown-input helpers for MIC schema parsers.
 *
 * MIC pages are filled from crawlers, AI output, and half-finished builder
 * trees. Callers must never assume a field is present; these helpers turn
 * missing / wrong-typed values into empty strings and empty arrays.
 */

/** True when `value` is a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Coerce to a string. Null, undefined, and non-strings become `''`. */
export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Coerce to a finite number. Non-numeric input falls back to `fallback`
 * (default `0`) so image `order` and similar fields stay defined.
 */
export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** Keep only string entries; anything else (including a missing field) → `[]`. */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Pick a member of a string union, or `fallback` when the value is absent
 * or not in the allow-list. Used for image type / source and patch enums.
 */
export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}
