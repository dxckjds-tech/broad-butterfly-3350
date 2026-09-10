/**
 * Content Agent — description, company profile, FAQ.
 *
 * Truth first: never invent certifications or specification rows.
 * Values not already on the page are tagged EXTERNAL_REFERENCE.
 */
import { createPatch } from '../protocol/patch'
import type { PatchSource } from '../protocol/patch'
import { createSuggestion } from '../protocol/suggestion'
import { asString, isRecord } from '../../mic/schema/coerce'
import { extractJsonRecord } from './json'
import { failedAgentResult } from './types'
import type { AgentContext, AgentResult, MicAgent } from './types'
import { resolveProvider } from '../providers/agentProvider'
import type { AgentProvider, ProviderAssignmentMap } from '../providers/types'

const CERT_TOKEN = /\b(ISO\s?\d{3,5}|CE|RoHS|UL|FDA|GS|TUV|CCC|IEC\s?\d+)\b/gi

export function knownCertifications(context: AgentContext): Set<string> {
  const values = [
    ...context.product.product.certifications,
    ...context.product.company.certifications,
  ]
  return new Set(values.map((entry) => entry.replace(/\s+/g, '').toUpperCase()).filter(Boolean))
}

export function stripInventedCerts(text: string, known: Set<string>): { text: string; stripped: string[] } {
  const stripped: string[] = []
  const next = text.replace(CERT_TOKEN, (match) => {
    const key = match.replace(/\s+/g, '').toUpperCase()
    if (known.has(key)) return match
    stripped.push(match)
    return ''
  })
  return { text: next.replace(/[ \t]{2,}/g, ' ').trim(), stripped }
}

function sourceForSpec(name: string, value: string, context: AgentContext): PatchSource {
  const exists = context.product.product.specifications.some(
    (row) => row.name === name && row.value === value,
  )
  return exists ? 'AI_GENERATED' : 'EXTERNAL_REFERENCE'
}

export class ContentAgent implements MicAgent {
  readonly id = 'content'
  readonly capability = 'content' as const

  constructor(
    private readonly assignments: ProviderAssignmentMap,
    private readonly providers: AgentProvider[],
  ) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const resolved = resolveProvider({
      capability: 'content',
      assignments: this.assignments,
      providers: this.providers,
    })
    if (!resolved.ok) {
      return failedAgentResult(resolved.model, resolved.code, resolved.warning)
    }

    const product = context.product.product
    const company = context.product.company
    const completed = await resolved.provider.complete({
      capability: 'content',
      prompt: [
        'Write MIC copy as JSON only:',
        '{"description":"","companyProfile":"","faq":[{"question":"","answer":""}],"specifications":[{"name":"","value":""}]}',
        'Use only facts from the input. Do not invent certifications or parameters.',
        `Title: ${product.productName}`,
        `Description: ${product.description}`,
        `Company: ${company.name} ${company.description} ${product.companyProfile}`,
        `Specs: ${JSON.stringify(product.specifications)}`,
        `Certifications: ${product.certifications.join(', ')}`,
        `FAQ: ${JSON.stringify(product.faq)}`,
      ].join('\n'),
    })

    if (!completed.ok) {
      return failedAgentResult(completed.model, completed.code, completed.warning)
    }

    const record = extractJsonRecord(completed.text)
    if (!record) {
      return failedAgentResult(completed.model, 'EMPTY_RESPONSE', 'Content JSON could not be parsed')
    }

    const known = knownCertifications(context)
    const warnings: string[] = []
    const suggestions = []

    const descriptionRaw = asString(record['description'])
    if (descriptionRaw) {
      const cleaned = stripInventedCerts(descriptionRaw, known)
      if (cleaned.stripped.length > 0) {
        warnings.push(`Removed unverified certification mentions: ${cleaned.stripped.join(', ')}`)
      }
      if (cleaned.text && cleaned.text !== product.description) {
        suggestions.push(
          createSuggestion({
            id: 'sug_content_description',
            title: '优化产品描述',
            description: 'Rewrite from on-page facts only',
            risk: 'LOW',
            patches: [
              createPatch({
                action: 'UPDATE',
                target: 'product.description',
                oldValue: product.description,
                newValue: cleaned.text,
                source: 'AI_GENERATED',
                confidence: 0.7,
              }),
            ],
          }),
        )
      }
    }

    const profileRaw = asString(record['companyProfile'])
    if (profileRaw) {
      const cleaned = stripInventedCerts(profileRaw, known)
      if (cleaned.stripped.length > 0) {
        warnings.push(`Removed unverified certification mentions: ${cleaned.stripped.join(', ')}`)
      }
      if (cleaned.text && cleaned.text !== product.companyProfile) {
        suggestions.push(
          createSuggestion({
            id: 'sug_content_profile',
            title: '优化公司简介',
            description: 'Company copy from provided profile only',
            risk: 'LOW',
            patches: [
              createPatch({
                action: 'UPDATE',
                target: 'product.companyProfile',
                oldValue: product.companyProfile,
                newValue: cleaned.text,
                source: 'AI_GENERATED',
                confidence: 0.65,
              }),
            ],
          }),
        )
      }
    }

    const faqInput = Array.isArray(record['faq']) ? record['faq'] : []
    for (const row of faqInput) {
      if (!isRecord(row)) continue
      const question = asString(row['question']).trim()
      const answer = asString(row['answer']).trim()
      if (!question || !answer) continue
      const duplicate = product.faq.some((entry) => entry.question === question)
      if (duplicate) continue
      suggestions.push(
        createSuggestion({
          id: `sug_content_faq_${suggestions.length}`,
          title: '补充 FAQ',
          description: question,
          risk: 'LOW',
          patches: [
            createPatch({
              action: 'INSERT',
              target: 'product.faq',
              newValue: { question, answer },
              source: 'AI_GENERATED',
              confidence: 0.6,
            }),
          ],
        }),
      )
    }

    const specInput = Array.isArray(record['specifications']) ? record['specifications'] : []
    for (const row of specInput) {
      if (!isRecord(row)) continue
      const name = asString(row['name']).trim()
      const value = asString(row['value']).trim()
      if (!name || !value) continue
      const exists = product.specifications.some((entry) => entry.name === name && entry.value === value)
      if (exists) continue
      const source = sourceForSpec(name, value, context)
      if (source === 'EXTERNAL_REFERENCE') {
        warnings.push(`Specification "${name}" is EXTERNAL_REFERENCE`)
      }
      suggestions.push(
        createSuggestion({
          id: `sug_content_spec_${name}`,
          title: '外部参数需核对',
          description: `${name}: ${value}`,
          risk: 'HIGH',
          patches: [
            createPatch({
              action: 'INSERT',
              target: 'product.specifications',
              newValue: { name, value },
              source,
              confidence: 0.4,
            }),
          ],
        }),
      )
    }

    return {
      success: true,
      suggestions,
      warnings,
      metadata: { model: completed.model, tokens: completed.tokens },
    }
  }
}
