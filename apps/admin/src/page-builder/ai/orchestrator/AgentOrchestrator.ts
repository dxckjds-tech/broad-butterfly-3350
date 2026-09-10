/**
 * Runs ProductIdentity → Keyword → Content → Verification.
 * Collects PENDING suggestions only. Never applies patches to the page.
 */
import { ProductIdentityAgent } from '../agents/ProductIdentityAgent'
import { KeywordAgent } from '../agents/KeywordAgent'
import { ContentAgent } from '../agents/ContentAgent'
import { VerificationAgent } from '../agents/VerificationAgent'
import type { AgentContext, AgentResult, MicAgent } from '../agents/types'
import type { AISuggestion } from '../protocol/suggestion'
import type { AgentProvider, ProviderAssignmentMap } from '../providers/types'

export const DEFAULT_AGENT_ORDER = ['identity', 'keyword', 'content', 'verification'] as const

export interface OrchestratorOptions {
  assignments: ProviderAssignmentMap
  providers: AgentProvider[]
}

export interface OrchestratorResult {
  suggestions: AISuggestion[]
  warnings: string[]
  steps: { id: string; result: AgentResult }[]
}

export class AgentOrchestrator {
  private readonly identity: ProductIdentityAgent
  private readonly keyword: KeywordAgent
  private readonly content: ContentAgent
  private readonly verification: VerificationAgent

  constructor(options: OrchestratorOptions) {
    this.identity = new ProductIdentityAgent(options.assignments, options.providers)
    this.keyword = new KeywordAgent(options.assignments, options.providers)
    this.content = new ContentAgent(options.assignments, options.providers)
    this.verification = new VerificationAgent(options.assignments, options.providers)
  }

  agents(): MicAgent[] {
    return [this.identity, this.keyword, this.content, this.verification]
  }

  async run(context: AgentContext): Promise<OrchestratorResult> {
    const steps: OrchestratorResult['steps'] = []
    const warnings: string[] = []
    const collected: AISuggestion[] = []

    const leading: MicAgent[] = [this.identity, this.keyword, this.content]
    for (const agent of leading) {
      const result = await agent.run(context)
      steps.push({ id: agent.id, result })
      warnings.push(...result.warnings)
      collected.push(...result.suggestions)
    }

    const verified = await this.verification.run({ ...context, suggestions: collected })
    steps.push({ id: this.verification.id, result: verified })
    warnings.push(...verified.warnings)

    return {
      suggestions: verified.suggestions.filter((entry) => entry.status === 'PENDING'),
      warnings,
      steps,
    }
  }
}
