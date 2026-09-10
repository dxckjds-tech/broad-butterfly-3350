import { parsePageDocument } from '../core/schema'
import type { PageDocument } from '../core/types'

export const STORAGE_KEY = 'asd.page-builder.document.v1'

/**
 * Autosave writes here, never over the manually saved document.
 *
 * Keeping the two apart is what makes recovery a decision rather than a
 * surprise: after a crash the committed document is still intact, and the
 * editor can offer the newer draft instead of silently adopting it.
 */
export const DRAFT_KEY = 'asd.page-builder.draft.v1'

export type LoadOutcome =
  | { status: 'loaded'; page: PageDocument }
  | { status: 'empty' }
  | { status: 'invalid'; error: string }

export function savePageDocument(page: PageDocument): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(page))
  } catch (error) {
    // Quota or private-mode failure — surface it, never swallow silently.
    console.error('[page-builder] save failed', error)
    throw error
  }
}

export function loadPageDocument(): LoadOutcome {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    return { status: 'invalid', error: String(error) }
  }
  if (!raw) return { status: 'empty' }

  let json: unknown
  try {
    json = JSON.parse(raw) as unknown
  } catch {
    return { status: 'invalid', error: 'stored document is not valid JSON' }
  }

  const parsed = parsePageDocument(json)
  return parsed.ok ? { status: 'loaded', page: parsed.page } : { status: 'invalid', error: parsed.error }
}

export interface DraftEnvelope {
  savedAt: string
  page: PageDocument
}

export type DraftOutcome =
  | { status: 'found'; draft: DraftEnvelope }
  | { status: 'empty' }
  | { status: 'invalid'; error: string }

export function saveDraft(page: PageDocument): string {
  const savedAt = new Date().toISOString()
  const envelope: DraftEnvelope = { savedAt, page }
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope))
  return savedAt
}

export function loadDraft(): DraftOutcome {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(DRAFT_KEY)
  } catch (error) {
    return { status: 'invalid', error: String(error) }
  }
  if (!raw) return { status: 'empty' }

  let json: unknown
  try {
    json = JSON.parse(raw) as unknown
  } catch {
    return { status: 'invalid', error: 'draft is not valid JSON' }
  }
  if (typeof json !== 'object' || json === null) {
    return { status: 'invalid', error: 'draft envelope is not an object' }
  }

  const envelope = json as { savedAt?: unknown; page?: unknown }
  // Drafts go through the same validation as any other input — a corrupt
  // draft must not be able to brick the editor on boot.
  const parsed = parsePageDocument(envelope.page)
  if (!parsed.ok) return { status: 'invalid', error: parsed.error }
  return {
    status: 'found',
    draft: {
      savedAt: typeof envelope.savedAt === 'string' ? envelope.savedAt : new Date(0).toISOString(),
      page: parsed.page,
    },
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to do — a stale draft is offered again next boot, not fatal.
  }
}

export function clearPageDocument(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
