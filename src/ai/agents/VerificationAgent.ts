/**
 * Verification Agent — last gate before suggestions reach the user.
 *
 * PASS / WARNING / BLOCKED. BLOCKED patches are dropped (not auto-applied,
 * not shown as ready-to-accept). Never writes the page.
 */
import { validateSuggestion } from '../protocol/validation'
import type { ValidationStatus } from '../protocol/validation'
import type { AISuggestion } from '../protocol/suggestion'
import { isRecord } from '../../mic/schema/coerce'
import { knownCertifications } from './ContentAgent'
import { emptyAgentResult } from './types'
import type { AgentContext, AgentResult, MicAgent } from './types'
import { resolveProvider } from '../providers/agentProvider'
import type { AgentProvider, ProviderAssignmentMap } from '../providers/types'

function worse(left: ValidationStatus, right: ValidationStatus): ValidationStatus {
  const rank: Record<ValidationStatus, number> = { PASS: 0, WARNING: 1, BLOCKED: 2 }
  return rank[right] > rank[left] ? right : left
}

function specKey(value: unknown): string {
  if (typeof value === 'string') return value
  if (isRecord(value)) return `${String(value['name'] ?? '')}::${String(value['value'] ?? '')}`
  return JSON.stringify(value)
}

export function inspectSuggestion(context: AgentContext, suggestion: AISuggestion): {
  status: ValidationStatus
  messages: string[]
} {
  const base = validateSuggestion(suggestion)
  let status = base.status
  const messages = [...base.messages]
  const knownCerts = knownCertifications(context)
  const knownSpecs = new Set(
    context.product.product.specifications.map((row) => `${row.name}::${row.value}`),
  )

  for (const patch of suggestion.patches) {
    if (patch.target.includes('certification')) {
      const token = String(patch.newValue ?? '').replace(/\s+/g, '').toUpperCase()
      if (token && !knownCerts.has(token) && patch.source === 'AI_GENERATED') {
        status = worse(status, 'BLOCKED')
        messages.push(`Invented certification "${String(patch.newValue)}" is blocked`)
      }
    }
    if (patch.target.includes('specification')) {
      const key = specKey(patch.newValue)
      if (patch.source === 'EXTERNAL_REFERENCE') {
        status = worse(status, 'WARNING')
        messages.push(`External specification ${key} needs review`)
      } else if (!knownSpecs.has(key) && patch.action !== 'DELETE') {
        status = worse(status, 'BLOCKED')
        messages.push(`Unverified specification ${key} is blocked`)
      }
    }
  }

  return { status, messages }
}

export class VerificationAgent implements MicAgent {
  readonly id = 'verification'
  readonly capability = 'verification' as const

  constructor(
    private readonly assignments: ProviderAssignmentMap,
    private readonly providers: AgentProvider[],
  ) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const incoming = context.suggestions ?? []
    const resolved = resolveProvider({
      capability: 'verification',
      assignments: this.assignments,
      providers: this.providers,
    })

    // Local rules always run. A missing verification model is a warning,
    // not a reason to skip the intercept.
    const warnings: string[] = []
    if (!resolved.ok) {
      warnings.push(`${resolved.code}: ${resolved.warning}`)
    } else {
      const completed = await resolved.provider.complete({
        capability: 'verification',
        prompt: `Review ${incoming.length} MIC suggestions. Reply JSON {"status":"PASS|WARNING|BLOCKED","notes":""}. Do not invent facts.`,
      })
      if (!completed.ok) {
        warnings.push(`${completed.code}: ${completed.warning}`)
      }
    }

    if (incoming.length === 0) {
      const empty = emptyAgentResult(resolved.ok ? resolved.provider.model : resolved.model)
      return { ...empty, warnings, metadata: { ...empty.metadata, verification: 'PASS' } }
    }

    const kept: AISuggestion[] = []
    let worst: ValidationStatus = 'PASS'
    for (const suggestion of incoming) {
      const inspected = inspectSuggestion(context, suggestion)
      worst = worse(worst, inspected.status)
      if (inspected.status === 'BLOCKED') {
        warnings.push(...inspected.messages)
        continue
      }
      if (inspected.status === 'WARNING') warnings.push(...inspected.messages)
      kept.push(suggestion)
    }

    if (!resolved.ok && incoming.length > 0 && kept.length === incoming.length && worst === 'PASS') {
      // Provider missing but local rules passed — still report the failure code.
      return {
        success: true,
        suggestions: kept,
        warnings,
        metadata: {
          model: resolved.model,
          failure: resolved.code,
          verification: worst,
        },
      }
    }

    if (resolved.ok) {
      return {
        success: true,
        suggestions: kept,
        warnings,
        metadata: { model: resolved.provider.model, verification: worst },
      }
    }

    return {
      success: worst !== 'BLOCKED',
      suggestions: kept,
      warnings,
      metadata: { model: resolved.model, failure: resolved.code, verification: worst },
    }
  }
}
