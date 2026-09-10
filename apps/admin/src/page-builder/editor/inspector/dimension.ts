/**
 * CSS length values as an (amount, unit) pair for the UI.
 *
 * The document keeps storing plain CSS strings — this is a presentation
 * concern only, so nothing in `core` needs to know about units.
 */
export const LENGTH_UNITS = ['px', '%', 'rem', 'em', 'vw', 'vh'] as const
export type LengthUnit = (typeof LENGTH_UNITS)[number]

/** Units that carry no number: selecting one clears the amount. */
export const KEYWORD_UNITS = ['auto', 'none'] as const
export type KeywordUnit = (typeof KEYWORD_UNITS)[number]

export type DimensionUnit = LengthUnit | KeywordUnit
export interface Dimension {
  amount: string
  unit: DimensionUnit
}

const NUMERIC = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*([a-z%]*)\s*$/i

/**
 * Parse a stored value. Anything unrecognised (`calc(...)`, `min-content`,
 * multi-value shorthands) returns null so the caller can fall back to a
 * free-text field instead of mangling it.
 */
export function parseDimension(value: unknown, fallbackUnit: LengthUnit = 'px'): Dimension | null {
  if (value === undefined || value === null || value === '') {
    return { amount: '', unit: fallbackUnit }
  }
  const text = String(value).trim()
  for (const keyword of KEYWORD_UNITS) {
    if (text === keyword) return { amount: '', unit: keyword }
  }
  const match = NUMERIC.exec(text)
  if (!match) return null
  const amount = match[1] ?? ''
  const unit = match[2] ?? ''
  if (unit === '') return { amount, unit: fallbackUnit }
  const lower = unit.toLowerCase()
  const known = LENGTH_UNITS.find((candidate) => candidate === lower)
  return known ? { amount, unit: known } : null
}

/** Back to a CSS string; an empty amount on a length unit clears the value. */
export function formatDimension(dimension: Dimension): string | null {
  if ((KEYWORD_UNITS as readonly string[]).includes(dimension.unit)) return dimension.unit
  if (dimension.amount.trim() === '') return null
  return `${dimension.amount.trim()}${dimension.unit}`
}

/** True when all four sides hold the same value (drives the link toggle). */
export function sidesAreEqual(values: readonly (string | undefined)[]): boolean {
  const [first, ...rest] = values
  return rest.every((value) => (value ?? '') === (first ?? ''))
}
