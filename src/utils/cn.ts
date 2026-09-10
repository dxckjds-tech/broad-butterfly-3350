export type ClassValue = string | false | null | undefined

/** Tiny classnames helper — no dependency, no variant magic. */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ')
}
