/**
 * AI Patch Protocol — the only way AI may propose edits to a MIC page.
 *
 * AI never writes `MICPageSchema` or the builder tree directly. It emits
 * `Patch` records; the editor applies them only after the user confirms
 * (`needConfirm` + `applyPatch(..., { confirmed: true })`).
 */
import type { MICPageSchema } from '../../mic/schema/page'
import { asEnum, asNumber, asString, isRecord } from '../../mic/schema/coerce'

export const PATCH_ACTIONS = ['UPDATE', 'INSERT', 'DELETE', 'MOVE'] as const
export type PatchAction = (typeof PATCH_ACTIONS)[number]

export const PATCH_SOURCES = ['AI_GENERATED', 'USER', 'EXTERNAL_REFERENCE'] as const
export type PatchSource = (typeof PATCH_SOURCES)[number]

export interface Patch {
  id: string
  action: PatchAction
  /** Dot path into `MICPageSchema`, e.g. `"product.productName"`. */
  target: string
  oldValue?: unknown
  newValue?: unknown
  source: PatchSource
  /** Model confidence in `[0, 1]`. Unknown / invalid values parse as `0`. */
  confidence: number
  /**
   * When true the patch must not be applied until the user confirms.
   * AI-generated patches always default to `true`.
   */
  needConfirm: boolean
  createdAt: string
}

/** Payload for `MOVE` — reorder an array at `target`. */
export interface PatchMoveValue {
  from: number
  to: number
}

/** Payload for `INSERT` when the caller wants a specific index. */
export interface PatchInsertValue {
  index: number
  item: unknown
}

function nowIso(): string {
  return new Date().toISOString()
}

function createPatchId(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined
  const raw =
    cryptoRef && typeof cryptoRef.randomUUID === 'function'
      ? cryptoRef.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `patch_${raw}`
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Build a patch. AI-generated patches always require confirmation, even if
 * the caller forgets `needConfirm`.
 */
export function createPatch(input: {
  action: PatchAction
  target: string
  oldValue?: unknown
  newValue?: unknown
  source?: PatchSource
  confidence?: number
  needConfirm?: boolean
  id?: string
  createdAt?: string
}): Patch {
  const source = input.source ?? 'AI_GENERATED'
  const needConfirm =
    source === 'AI_GENERATED' || source === 'EXTERNAL_REFERENCE'
      ? true
      : (input.needConfirm ?? false)
  const patch: Patch = {
    id: input.id ?? createPatchId(),
    action: input.action,
    target: input.target,
    source,
    confidence: clampConfidence(input.confidence ?? 0),
    needConfirm,
    createdAt: input.createdAt ?? nowIso(),
  }
  if (input.oldValue !== undefined) patch.oldValue = input.oldValue
  if (input.newValue !== undefined) patch.newValue = input.newValue
  return patch
}

/** Parse untrusted JSON into a `Patch`. Invalid shapes get safe defaults. */
export function parsePatch(input: unknown): Patch {
  const record = isRecord(input) ? input : {}
  return createPatch({
    id: asString(record['id']) || undefined,
    action: asEnum(record['action'], PATCH_ACTIONS, 'UPDATE'),
    target: asString(record['target']),
    oldValue: record['oldValue'],
    newValue: record['newValue'],
    source: asEnum(record['source'], PATCH_SOURCES, 'AI_GENERATED'),
    confidence: asNumber(record['confidence'], 0),
    needConfirm:
      record['needConfirm'] === false ? false : record['needConfirm'] === true ? true : undefined,
    createdAt: asString(record['createdAt']) || undefined,
  })
}

function isMoveValue(value: unknown): value is PatchMoveValue {
  if (!isRecord(value)) return false
  return typeof value['from'] === 'number' && typeof value['to'] === 'number'
}

function isInsertValue(value: unknown): value is PatchInsertValue {
  if (!isRecord(value)) return false
  return typeof value['index'] === 'number' && 'item' in value
}

function splitPath(path: string): string[] {
  return path.split('.').filter((segment) => segment.length > 0)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

type PathParent =
  | { kind: 'record'; record: Record<string, unknown>; key: string }
  | { kind: 'array'; array: unknown[]; index: number }

function locateParent(root: Record<string, unknown>, path: string): PathParent | null {
  const segments = splitPath(path)
  if (segments.length === 0) return null
  const last = segments[segments.length - 1]
  if (last === undefined) return null

  let cursor: unknown = root
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(cursor)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) return null
      cursor = cursor[index]
      continue
    }
    if (!isRecord(cursor)) return null
    cursor = cursor[segment]
  }

  if (Array.isArray(cursor)) {
    const index = Number(last)
    if (!Number.isInteger(index) || index < 0) return null
    return { kind: 'array', array: cursor, index }
  }
  if (isRecord(cursor)) return { kind: 'record', record: cursor, key: last }
  return null
}

function readAt(root: Record<string, unknown>, path: string): unknown {
  const parent = locateParent(root, path)
  if (!parent) return undefined
  if (parent.kind === 'array') return parent.array[parent.index]
  return parent.record[parent.key]
}

export type ApplyPatchResult =
  | { ok: true; page: MICPageSchema }
  | { ok: false; error: string }

/**
 * Apply one patch to a MIC page.
 *
 * AI patches (`needConfirm: true`) are refused unless `options.confirmed`
 * is set. Callers should only pass `confirmed: true` after the user accepts
 * the suggestion. This function never touches the page-builder store.
 */
export function applyPatch(
  page: MICPageSchema,
  patch: Patch,
  options: { confirmed?: boolean } = {},
): ApplyPatchResult {
  if (patch.target.trim() === '') {
    return { ok: false, error: 'Patch target is empty' }
  }
  if (patch.needConfirm && options.confirmed !== true) {
    return { ok: false, error: 'Patch requires user confirmation before it can be applied' }
  }

  const next = cloneJson(page)
  const root = next as unknown as Record<string, unknown>
  const parent = locateParent(root, patch.target)
  if (!parent) return { ok: false, error: `Cannot resolve patch target "${patch.target}"` }

  if (patch.action === 'UPDATE') {
    const current = readAt(root, patch.target)
    if (patch.oldValue !== undefined && !valuesEqual(current, patch.oldValue)) {
      return { ok: false, error: `Stale patch: "${patch.target}" no longer matches oldValue` }
    }
    if (parent.kind === 'array') {
      if (parent.index >= parent.array.length) {
        return { ok: false, error: `Index ${parent.index} is out of range for "${patch.target}"` }
      }
      parent.array[parent.index] = patch.newValue
    } else {
      parent.record[parent.key] = patch.newValue
    }
    next.metadata.updatedAt = nowIso()
    return { ok: true, page: next }
  }

  if (patch.action === 'INSERT') {
    const targetValue = readAt(root, patch.target)
    const array = Array.isArray(targetValue)
      ? targetValue
      : parent.kind === 'array'
        ? parent.array
        : null
    if (!array) return { ok: false, error: `INSERT requires an array at "${patch.target}"` }
    if (isInsertValue(patch.newValue)) {
      const index = Math.max(0, Math.min(patch.newValue.index, array.length))
      array.splice(index, 0, patch.newValue.item)
    } else {
      array.push(patch.newValue)
    }
    next.metadata.updatedAt = nowIso()
    return { ok: true, page: next }
  }

  if (patch.action === 'DELETE') {
    if (parent.kind === 'array') {
      if (parent.index >= parent.array.length) {
        return { ok: false, error: `Index ${parent.index} is out of range for "${patch.target}"` }
      }
      parent.array.splice(parent.index, 1)
    } else {
      parent.record[parent.key] = emptyFor(parent.record[parent.key])
    }
    next.metadata.updatedAt = nowIso()
    return { ok: true, page: next }
  }

  if (patch.action === 'MOVE') {
    const targetValue = readAt(root, patch.target)
    if (!Array.isArray(targetValue)) {
      return { ok: false, error: `MOVE requires an array at "${patch.target}"` }
    }
    if (!isMoveValue(patch.newValue)) {
      return { ok: false, error: 'MOVE newValue must be { from, to }' }
    }
    const { from, to } = patch.newValue
    if (from < 0 || from >= targetValue.length || to < 0 || to >= targetValue.length) {
      return { ok: false, error: `MOVE indexes out of range for "${patch.target}"` }
    }
    const [item] = targetValue.splice(from, 1)
    if (item === undefined) return { ok: false, error: `MOVE source index ${from} was empty` }
    targetValue.splice(to, 0, item)
    next.metadata.updatedAt = nowIso()
    return { ok: true, page: next }
  }

  return { ok: false, error: `Unsupported patch action "${String(patch.action)}"` }
}

/** Reset a deleted object field to an empty value of the same kind. */
function emptyFor(value: unknown): unknown {
  if (Array.isArray(value)) return []
  if (typeof value === 'string') return ''
  if (typeof value === 'number') return 0
  if (typeof value === 'boolean') return false
  if (isRecord(value)) return {}
  return ''
}
