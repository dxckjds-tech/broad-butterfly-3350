/**
 * Run the MIC agent pipeline. Pure aside from the injected providers —
 * does not touch the editor store or apply patches.
 */
import { AgentOrchestrator } from '../../ai/orchestrator/AgentOrchestrator'
import type { OrchestratorResult } from '../../ai/orchestrator/AgentOrchestrator'
import { createAssignedProviders, parseAssignments } from '../../ai/providers/agentProvider'
import type { ProviderAssignmentMap, ProviderSecrets } from '../../ai/providers'
import type { AgentProvider } from '../../ai/providers/types'
import type { MICPageSchema } from '../schema/page'

export interface RunMicAgentsInput {
  page: MICPageSchema
  task?: string
  assignments?: ProviderAssignmentMap
  providers?: AgentProvider[]
  secrets?: ProviderSecrets
  env?: Record<string, string | undefined>
}

export async function runMicAgents(input: RunMicAgentsInput): Promise<OrchestratorResult> {
  const assignments = input.assignments ?? parseAssignments(input.env ?? {})
  const providers = input.providers ?? createAssignedProviders(assignments, input.secrets ?? {})
  const orchestrator = new AgentOrchestrator({ assignments, providers })
  return orchestrator.run({
    product: input.page,
    images: input.page.product.images,
    task: input.task ?? 'optimize-mic-listing',
  })
}
