/**
 * Shared Agent Layer types (v0.3.0 Step 4).
 *
 * Agents never write `MICPageSchema` or the builder tree. They only emit
 * `AISuggestion[]` that stay PENDING until the user accepts them.
 */
import type { ImageSchema } from '../../mic/schema/image'
import type { MICPageSchema } from '../../mic/schema/page'
import type { AISuggestion } from '../protocol/suggestion'
import type { ValidationStatus } from '../protocol/validation'

export const AGENT_FAILURES = [
  'MODEL_UNAVAILABLE',
  'ROLE_CAPABILITY_MISMATCH',
  'TIMEOUT',
  'EMPTY_RESPONSE',
] as const

export type AgentFailureCode = (typeof AGENT_FAILURES)[number]

export const TASK_CAPABILITIES = ['vision', 'keyword', 'content', 'verification'] as const
export type TaskCapability = (typeof TASK_CAPABILITIES)[number]

export interface AgentContext {
  product: MICPageSchema
  images?: ImageSchema[]
  task: string
  /** Filled by the orchestrator before Verification runs. */
  suggestions?: AISuggestion[]
}

export interface AgentResult {
  success: boolean
  suggestions: AISuggestion[]
  warnings: string[]
  metadata: {
    model: string
    tokens?: number
    failure?: AgentFailureCode
    productType?: string
    confidence?: number
    possibleCategory?: string
    verification?: ValidationStatus
  }
}

export interface MicAgent {
  readonly id: string
  readonly capability: TaskCapability
  run(context: AgentContext): Promise<AgentResult>
}

export function failedAgentResult(
  model: string,
  failure: AgentFailureCode,
  detail: string,
): AgentResult {
  return {
    success: false,
    suggestions: [],
    warnings: [`${failure}: ${detail}`],
    metadata: { model, failure },
  }
}

export function emptyAgentResult(model: string): AgentResult {
  return { success: true, suggestions: [], warnings: [], metadata: { model } }
}
