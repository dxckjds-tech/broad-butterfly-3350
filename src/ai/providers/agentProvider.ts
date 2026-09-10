/**
 * Capability → provider resolver.
 *
 * The user assigns a brand + model per task. This module never picks a
 * substitute brand when the assignment is missing, unsupported, or down.
 */
import type { TaskCapability } from '../agents/types'
import { capabilitiesForProvider } from './catalog'
import { createHttpProvider } from './httpProvider'
import type { ProviderSecrets } from './httpProvider'
import type {
  AgentProvider,
  ProviderAssignmentMap,
  ProviderBinding,
  ProviderId,
  ProviderResolveResult,
} from './types'
import { PROVIDER_IDS } from './types'

export interface ResolveProviderInput {
  capability: TaskCapability
  assignments: ProviderAssignmentMap
  providers: AgentProvider[]
}

/**
 * Resolve the provider the user assigned to `capability`.
 * Does not fall back to another brand.
 */
export function resolveProvider(input: ResolveProviderInput): ProviderResolveResult {
  const binding = input.assignments[input.capability]
  if (!binding || binding.model.trim() === '') {
    return {
      ok: false,
      code: 'MODEL_UNAVAILABLE',
      warning: `No model assigned for capability "${input.capability}"`,
      model: '',
    }
  }

  const provider = input.providers.find(
    (entry) => entry.id === binding.provider && entry.model === binding.model,
  )
  if (!provider) {
    return {
      ok: false,
      code: 'MODEL_UNAVAILABLE',
      warning: `Provider "${binding.provider}" / "${binding.model}" is not registered`,
      model: binding.model,
    }
  }

  if (!provider.supports(input.capability)) {
    return {
      ok: false,
      code: 'ROLE_CAPABILITY_MISMATCH',
      warning: `${binding.provider} / ${binding.model} cannot perform "${input.capability}"`,
      model: binding.model,
    }
  }

  return { ok: true, provider }
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value)
}

/**
 * Read assignments from a flat env/config bag. Keys are capability names,
 * values are `provider:model` (model is whatever the user configured).
 *
 * Example: `{ vision: "gemini:my-vision-model", content: "openai:my-chat-model" }`
 */
export function parseAssignments(source: Record<string, string | undefined>): ProviderAssignmentMap {
  const map: ProviderAssignmentMap = {}
  const keys: TaskCapability[] = ['vision', 'keyword', 'content', 'verification']
  for (const capability of keys) {
    const raw = source[capability] ?? source[`AGENT_${capability.toUpperCase()}`] ?? ''
    const parsed = parseBinding(raw)
    if (parsed) map[capability] = parsed
  }
  return map
}

export function parseBinding(raw: string): ProviderBinding | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const split = trimmed.indexOf(':')
  if (split <= 0) return null
  const provider = trimmed.slice(0, split).trim()
  const model = trimmed.slice(split + 1).trim()
  if (!isProviderId(provider) || model === '') return null
  return { provider, model }
}

/** Instantiate HTTP providers for each unique assignment. One instance per binding. */
export function createAssignedProviders(
  assignments: ProviderAssignmentMap,
  secrets: ProviderSecrets,
): AgentProvider[] {
  const seen = new Set<string>()
  const providers: AgentProvider[] = []
  for (const binding of Object.values(assignments)) {
    if (!binding) continue
    const key = `${binding.provider}:${binding.model}`
    if (seen.has(key)) continue
    seen.add(key)
    providers.push(
      createHttpProvider({
        binding,
        secrets,
        capabilities: capabilitiesForProvider(binding.provider),
      }),
    )
  }
  return providers
}

export type { ProviderSecrets }
