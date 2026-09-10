/**
 * Patch / suggestion validation.
 *
 * Rules (v0.3.0 Step 1):
 * 1. AI-generated content must be confirmed (`needConfirm === true`);
 *    otherwise the result is BLOCKED.
 * 2. `source === "EXTERNAL_REFERENCE"` is at least WARNING.
 * 3. High-risk fields (certifications, specifications / parameters) are
 *    WARNING when confirmation is required, BLOCKED when it is not.
 *
 * Validation never mutates the page. A BLOCKED result must not be applied.
 */
import type { Patch } from './patch'
import type { AISuggestion } from './suggestion'

export const VALIDATION_STATUSES = ['PASS', 'WARNING', 'BLOCKED'] as const
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

export interface ValidationResult {
  status: ValidationStatus
  messages: string[]
}

/**
 * Dot-path prefixes treated as high risk: certifications, specification
 * tables, and packaging claims. Matching is prefix-based so
 * `product.specifications.0.value` is included.
 */
export const HIGH_RISK_TARGETS = [
  'product.certifications',
  'product.specifications',
  'product.packaging',
  'company.certifications',
] as const

const RANK: Record<ValidationStatus, number> = {
  PASS: 0,
  WARNING: 1,
  BLOCKED: 2,
}

function worse(left: ValidationStatus, right: ValidationStatus): ValidationStatus {
  return RANK[right] > RANK[left] ? right : left
}

function isHighRiskTarget(target: string): boolean {
  return HIGH_RISK_TARGETS.some(
    (prefix) => target === prefix || target.startsWith(`${prefix}.`),
  )
}

function merge(results: ValidationResult[]): ValidationResult {
  let status: ValidationStatus = 'PASS'
  const messages: string[] = []
  for (const result of results) {
    status = worse(status, result.status)
    messages.push(...result.messages)
  }
  return { status, messages }
}

/**
 * Validate a single patch against the confirm / source / high-risk rules.
 */
export function validatePatch(patch: Patch): ValidationResult {
  const parts: ValidationResult[] = []

  if (patch.target.trim() === '') {
    parts.push({ status: 'BLOCKED', messages: ['Patch target is empty'] })
  }

  if (patch.confidence < 0 || patch.confidence > 1) {
    parts.push({ status: 'BLOCKED', messages: ['Patch confidence must be between 0 and 1'] })
  }

  if (patch.source === 'AI_GENERATED' && patch.needConfirm !== true) {
    parts.push({
      status: 'BLOCKED',
      messages: ['AI-generated patches must set needConfirm=true'],
    })
  }

  if (patch.source === 'EXTERNAL_REFERENCE') {
    parts.push({
      status: 'WARNING',
      messages: ['Patch source is EXTERNAL_REFERENCE — treat as unverified'],
    })
    if (patch.needConfirm !== true) {
      parts.push({
        status: 'BLOCKED',
        messages: ['EXTERNAL_REFERENCE patches must set needConfirm=true'],
      })
    }
  }

  if (isHighRiskTarget(patch.target)) {
    if (patch.needConfirm === true) {
      parts.push({
        status: 'WARNING',
        messages: [`High-risk field "${patch.target}" requires explicit review`],
      })
    } else {
      parts.push({
        status: 'BLOCKED',
        messages: [`High-risk field "${patch.target}" cannot be applied without confirmation`],
      })
    }
  }

  if (parts.length === 0) return { status: 'PASS', messages: [] }
  return merge(parts)
}

/** Validate every patch in a suggestion and surface the worst status. */
export function validateSuggestion(suggestion: AISuggestion): ValidationResult {
  if (suggestion.patches.length === 0) {
    return { status: 'BLOCKED', messages: ['Suggestion contains no patches'] }
  }
  const patchResults = suggestion.patches.map(validatePatch)
  if (suggestion.risk === 'HIGH') {
    patchResults.push({
      status: 'WARNING',
      messages: ['Suggestion is marked HIGH risk'],
    })
  }
  return merge(patchResults)
}

export { isHighRiskTarget }
