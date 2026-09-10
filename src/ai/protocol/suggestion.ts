/**
 * AI suggestion — a named bundle of patches for the future suggestion panel.
 *
 * Status starts at `PENDING`. Patches inside a suggestion are not applied
 * until the suggestion is `APPROVED` and `applySuggestion` is called.
 */
import type { MICPageSchema } from '../../mic/schema/page'
import { applyPatch, createPatch, parsePatch } from './patch'
import type { ApplyPatchResult, Patch } from './patch'
import { asEnum, asString, isRecord } from '../../mic/schema/coerce'

export const SUGGESTION_RISKS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type SuggestionRisk = (typeof SUGGESTION_RISKS)[number]

export const SUGGESTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]

export interface AISuggestion {
  id: string
  title: string
  description: string
  patches: Patch[]
  risk: SuggestionRisk
  status: SuggestionStatus
}

function createSuggestionId(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined
  const raw =
    cryptoRef && typeof cryptoRef.randomUUID === 'function'
      ? cryptoRef.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `sug_${raw}`
}

/**
 * Build a suggestion. New suggestions are always `PENDING` so AI output
 * cannot skip the confirm step by stuffing `status: "APPROVED"` in JSON.
 */
export function createSuggestion(input: {
  title: string
  description: string
  patches: Patch[]
  risk?: SuggestionRisk
  id?: string
}): AISuggestion {
  return {
    id: input.id ?? createSuggestionId(),
    title: input.title,
    description: input.description,
    patches: input.patches.map((patch) => createPatch(patch)),
    risk: input.risk ?? 'LOW',
    status: 'PENDING',
  }
}

export function parseSuggestion(input: unknown): AISuggestion {
  const record = isRecord(input) ? input : {}
  const patches = Array.isArray(record['patches']) ? record['patches'].map(parsePatch) : []
  const suggestion = createSuggestion({
    id: asString(record['id']) || undefined,
    title: asString(record['title']),
    description: asString(record['description']),
    patches,
    risk: asEnum(record['risk'], SUGGESTION_RISKS, 'LOW'),
  })
  // Parsed status is kept for persistence, but applySuggestion still
  // requires APPROVED — PENDING AI payloads cannot self-approve.
  suggestion.status = asEnum(record['status'], SUGGESTION_STATUSES, 'PENDING')
  return suggestion
}

export function approveSuggestion(suggestion: AISuggestion): AISuggestion {
  return { ...suggestion, status: 'APPROVED' }
}

export function rejectSuggestion(suggestion: AISuggestion): AISuggestion {
  return { ...suggestion, status: 'REJECTED' }
}

/**
 * Apply every patch in an approved suggestion.
 *
 * Rejected / pending suggestions are refused. Each patch is applied with
 * `confirmed: true` because approval is the user confirmation step.
 */
export function applySuggestion(page: MICPageSchema, suggestion: AISuggestion): ApplyPatchResult {
  if (suggestion.status !== 'APPROVED') {
    return {
      ok: false,
      error: `Suggestion "${suggestion.id}" is ${suggestion.status}; only APPROVED suggestions can be applied`,
    }
  }

  let current = page
  for (const patch of suggestion.patches) {
    const result = applyPatch(current, patch, { confirmed: true })
    if (!result.ok) return result
    current = result.page
  }
  return { ok: true, page: current }
}
