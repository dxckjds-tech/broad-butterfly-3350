/**
 * Explicit test / fixture provider. Never used as a silent fallback when a
 * real assignment fails — the caller must construct it on purpose.
 */
import type { TaskCapability } from '../agents/types'
import type { AgentCompleteRequest, AgentCompleteResponse, AgentProvider, ProviderId } from './types'

export type ScriptedHandler = (request: AgentCompleteRequest) => AgentCompleteResponse | Promise<AgentCompleteResponse>

export function createScriptedProvider(input: {
  id: ProviderId
  model: string
  capabilities: readonly TaskCapability[]
  handler: ScriptedHandler
}): AgentProvider {
  const capabilities = new Set(input.capabilities)
  return {
    id: input.id,
    model: input.model,
    supports(capability) {
      return capabilities.has(capability)
    },
    async complete(request) {
      if (!capabilities.has(request.capability)) {
        return {
          ok: false,
          code: 'ROLE_CAPABILITY_MISMATCH',
          warning: `Provider "${input.id}" does not support ${request.capability}`,
          model: input.model,
        }
      }
      return input.handler(request)
    },
  }
}
