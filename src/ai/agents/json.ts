import { isRecord } from '../../mic/schema/coerce'

/** Pull the first JSON object or array out of a model string (fences allowed). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(unfenced)
  } catch {
    const objectStart = unfenced.indexOf('{')
    const arrayStart = unfenced.indexOf('[')
    const start =
      objectStart === -1
        ? arrayStart
        : arrayStart === -1
          ? objectStart
          : Math.min(objectStart, arrayStart)
    if (start < 0) return null
    const opener = unfenced[start]
    const closer = opener === '[' ? ']' : '}'
    const end = unfenced.lastIndexOf(closer)
    if (end <= start) return null
    try {
      return JSON.parse(unfenced.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export function extractJsonRecord(text: string): Record<string, unknown> | null {
  const parsed = extractJson(text)
  return isRecord(parsed) ? parsed : null
}

export function asFinite01(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number)) return fallback
  if (number < 0) return 0
  if (number > 1) return 1
  return number
}
