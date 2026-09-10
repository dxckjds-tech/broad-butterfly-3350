/**
 * Product Identity Agent — classify the listing (type / category).
 * Requires a vision-capable model when images are present. Never swaps models.
 */
import { createPatch } from '../protocol/patch'
import { createSuggestion } from '../protocol/suggestion'
import { asString } from '../../mic/schema/coerce'
import { extractJsonRecord, asFinite01 } from './json'
import { failedAgentResult } from './types'
import type { AgentContext, AgentResult, MicAgent } from './types'
import { resolveProvider } from '../providers/agentProvider'
import type { AgentProvider, ProviderAssignmentMap } from '../providers/types'

export interface ProductIdentityOutput {
  productType: string
  confidence: number
  possibleCategory: string
}

export class ProductIdentityAgent implements MicAgent {
  readonly id = 'identity'
  readonly capability = 'vision' as const

  constructor(
    private readonly assignments: ProviderAssignmentMap,
    private readonly providers: AgentProvider[],
  ) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const resolved = resolveProvider({
      capability: 'vision',
      assignments: this.assignments,
      providers: this.providers,
    })
    if (!resolved.ok) {
      return failedAgentResult(resolved.model, resolved.code, resolved.warning)
    }

    const images = context.images ?? context.product.product.images
    const hasImages = images.some((image) => image.url.trim() !== '')
    if (hasImages && !resolved.provider.supports('vision')) {
      return failedAgentResult(
        resolved.provider.model,
        'ROLE_CAPABILITY_MISMATCH',
        'Product identity requires a vision-capable model when images are present',
      )
    }

    const product = context.product.product
    const completed = await resolved.provider.complete({
      capability: 'vision',
      images: hasImages ? images.filter((image) => image.url).map((image) => ({ url: image.url })) : undefined,
      prompt: [
        'Identify the MIC product. Reply with JSON only:',
        '{"productType":"","confidence":0,"possibleCategory":""}',
        `Title: ${product.productName}`,
        `Category: ${product.category}`,
        `Task: ${context.task}`,
      ].join('\n'),
    })

    if (!completed.ok) {
      return failedAgentResult(completed.model, completed.code, completed.warning)
    }

    const record = extractJsonRecord(completed.text)
    if (!record) {
      return failedAgentResult(completed.model, 'EMPTY_RESPONSE', 'Identity JSON could not be parsed')
    }

    const identity: ProductIdentityOutput = {
      productType: asString(record['productType']),
      confidence: asFinite01(record['confidence']),
      possibleCategory: asString(record['possibleCategory']),
    }

    const suggestions = []
    const nextCategory = identity.possibleCategory.trim()
    if (nextCategory !== '' && nextCategory !== product.category) {
      suggestions.push(
        createSuggestion({
          id: 'sug_identity_category',
          title: '对齐商品类目',
          description: `Possible category from product identity (${identity.productType || 'unknown type'})`,
          risk: 'LOW',
          patches: [
            createPatch({
              action: 'UPDATE',
              target: 'product.category',
              oldValue: product.category,
              newValue: nextCategory,
              source: 'AI_GENERATED',
              confidence: identity.confidence,
            }),
          ],
        }),
      )
    }

    return {
      success: true,
      suggestions,
      warnings: [],
      metadata: {
        model: completed.model,
        tokens: completed.tokens,
        productType: identity.productType,
        confidence: identity.confidence,
        possibleCategory: identity.possibleCategory,
      },
    }
  }
}
