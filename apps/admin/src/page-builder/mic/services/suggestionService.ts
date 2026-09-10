/**
 * Pure suggestion helpers. Never writes the Zustand store or auto-applies AI
 * patches. The UI must call `confirmSuggestion` only after a user click.
 */
import {
  applySuggestion,
  approveSuggestion,
  createSuggestion,
  rejectSuggestion,
} from '../../ai/protocol/suggestion'
import type { AISuggestion } from '../../ai/protocol/suggestion'
import { createPatch } from '../../ai/protocol/patch'
import type { MICPageSchema } from '../schema/page'

export type SuggestionServiceResult =
  | { ok: true; page: MICPageSchema; suggestion: AISuggestion }
  | { ok: false; error: string; page: MICPageSchema; suggestion: AISuggestion }

/**
 * Preview-only suggestions for the current MIC page.
 * Status is always PENDING. This is fixture data, not an AI API call.
 */
export function createPreviewSuggestions(page: MICPageSchema): AISuggestion[] {
  const title = page.product.productName
  const improved =
    title.toLowerCase().includes('cordless') || title.trim() === ''
      ? `${title || 'Product'} for Export`
      : `Cordless ${title}`

  return [
    createSuggestion({
      id: 'sug_preview_title',
      title: '优化标题',
      description: 'Improve buyer search matching',
      risk: 'LOW',
      patches: [
        createPatch({
          action: 'UPDATE',
          target: 'product.productName',
          oldValue: title,
          newValue: improved,
          source: 'AI_GENERATED',
          confidence: 0.92,
        }),
      ],
    }),
    createSuggestion({
      id: 'sug_preview_keywords',
      title: '补充关键词',
      description: 'Add an OEM keyword for search coverage',
      risk: 'MEDIUM',
      patches: [
        createPatch({
          action: 'INSERT',
          target: 'product.keywords',
          newValue: 'OEM',
          source: 'AI_GENERATED',
          confidence: 0.74,
        }),
      ],
    }),
    createSuggestion({
      id: 'sug_preview_certs',
      title: '认证字段需人工核对',
      description: 'High-risk field — display only until confirmed',
      risk: 'HIGH',
      patches: [
        createPatch({
          action: 'INSERT',
          target: 'product.certifications',
          newValue: 'ISO9001',
          source: 'AI_GENERATED',
          confidence: 0.41,
        }),
      ],
    }),
  ]
}

/**
 * User clicked Accept: PENDING → APPROVED → apply patches to the MIC page.
 * Refuses REJECTED suggestions. Never applied without this confirm path.
 */
export function confirmSuggestion(page: MICPageSchema, suggestion: AISuggestion): SuggestionServiceResult {
  if (suggestion.status === 'REJECTED') {
    return { ok: false, error: 'Rejected suggestions cannot be applied', page, suggestion }
  }
  const approved = approveSuggestion(suggestion)
  const applied = applySuggestion(page, approved)
  if (!applied.ok) {
    return { ok: false, error: applied.error, page, suggestion: approved }
  }
  return { ok: true, page: applied.page, suggestion: approved }
}

/** User clicked Reject: mark REJECTED without touching the page. */
export function declineSuggestion(page: MICPageSchema, suggestion: AISuggestion): SuggestionServiceResult {
  return { ok: true, page, suggestion: rejectSuggestion(suggestion) }
}

/**
 * Guard used by tests: applying a PENDING suggestion must fail.
 * The UI must never call this for AI output.
 */
export function applyWithoutApproval(page: MICPageSchema, suggestion: AISuggestion) {
  return applySuggestion(page, suggestion)
}

export function replaceSuggestion(list: AISuggestion[], next: AISuggestion): AISuggestion[] {
  return list.map((entry) => (entry.id === next.id ? next : entry))
}
