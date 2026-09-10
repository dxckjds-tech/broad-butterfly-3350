/**
 * Model adapter types. Provider *brands* are listed so a user can mix them;
 * model *ids* are never hardcoded — they come from assignments.
 */
import type { AgentFailureCode, TaskCapability } from '../agents/types'

export const PROVIDER_IDS = ['openai', 'gemini', 'deepseek', 'kimi', 'claude'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface ProviderBinding {
  provider: ProviderId
  /** Caller-supplied model id, e.g. whatever the user typed. Never inferred. */
  model: string
}

export type ProviderAssignmentMap = Partial<Record<TaskCapability, ProviderBinding>>

export interface AgentCompleteRequest {
  capability: TaskCapability
  prompt: string
  images?: { url: string }[]
  timeoutMs?: number
}

export type AgentCompleteResponse =
  | { ok: true; text: string; model: string; tokens?: number }
  | { ok: false; code: AgentFailureCode; warning: string; model: string }

export interface AgentProvider {
  readonly id: ProviderId
  readonly model: string
  supports(capability: TaskCapability): boolean
  complete(request: AgentCompleteRequest): Promise<AgentCompleteResponse>
}

export type ProviderResolveResult =
  | { ok: true; provider: AgentProvider }
  | { ok: false; code: AgentFailureCode; warning: string; model: string }
