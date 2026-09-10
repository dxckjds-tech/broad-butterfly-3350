/**
 * Keyword Agent — three MIC search phrases.
 *
 * 1. Generic product noun
 * 2. Attribute + product
 * 3. High-intent long tail
 *
 * Never claims "highest search volume" without real volume data.
 */
import { createPatch } from '../protocol/patch'
import { createSuggestion } from '../protocol/suggestion'
import { asNumber, asString, isRecord } from '../../mic/schema/coerce'
import { extractJson } from './json'
import { failedAgentResult } from './types'
import type { AgentContext, AgentResult, MicAgent } from './types'
import { resolveProvider } from '../providers/agentProvider'
import type { AgentProvider, ProviderAssignmentMap } from '../providers/types'

export const KEYWORD_INTENTS = ['GENERIC', 'ATTRIBUTE', 'LONG_TAIL'] as const
export type KeywordIntent = (typeof KEYWORD_INTENTS)[number]

export interface KeywordCandidate {
  keyword: string
  intent: KeywordIntent
  reason: string
  confidence: number
}

const FORBIDDEN_VOLUME = /搜索量最高|最高搜索|highest search volume|top searched|most searched|流量最大/i

export function softenKeywordReason(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed === '') return '行业惯用 phrasing for MIC listings'
  if (FORBIDDEN_VOLUME.test(trimmed)) {
    return '常见 industry phrasing — no verified search-volume data'
  }
  return trimmed
}

export function parseKeywordCandidates(text: string): KeywordCandidate[] {
  const parsed = extractJson(text)
  const rows = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed['keywords']) ? parsed['keywords'] : []
  const out: KeywordCandidate[] = []
  for (const row of rows) {
    if (!isRecord(row)) continue
    const intentRaw = asString(row['intent']).toUpperCase().replace(/-/g, '_')
    const intent: KeywordIntent =
      intentRaw === 'ATTRIBUTE' || intentRaw === 'LONG_TAIL' ? intentRaw : 'GENERIC'
    const keyword = asString(row['keyword']).trim()
    if (keyword === '') continue
    const confidenceRaw = row['confidence']
    const confidence =
      typeof confidenceRaw === 'number'
        ? confidenceRaw
        : asNumber(confidenceRaw, 0)
    out.push({
      keyword,
      intent,
      reason: softenKeywordReason(asString(row['reason'])),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    })
  }
  return out
}

export class KeywordAgent implements MicAgent {
  readonly id = 'keyword'
  readonly capability = 'keyword' as const

  constructor(
    private readonly assignments: ProviderAssignmentMap,
    private readonly providers: AgentProvider[],
  ) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const resolved = resolveProvider({
      capability: 'keyword',
      assignments: this.assignments,
      providers: this.providers,
    })
    if (!resolved.ok) {
      return failedAgentResult(resolved.model, resolved.code, resolved.warning)
    }

    const product = context.product.product
    const completed = await resolved.provider.complete({
      capability: 'keyword',
      prompt: [
        'Propose exactly three MIC keywords as JSON array:',
        '[{"keyword":"","intent":"GENERIC|ATTRIBUTE|LONG_TAIL","reason":"","confidence":0}]',
        'Intent GENERIC = core product noun; ATTRIBUTE = attribute + product; LONG_TAIL = high-intent phrase.',
        'Do not claim search volume unless you have measurements. Prefer 可能 / 常见 / 行业惯用.',
        `Title: ${product.productName}`,
        `Category: ${product.category}`,
        `Existing: ${product.keywords.join(', ')}`,
      ].join('\n'),
    })

    if (!completed.ok) {
      return failedAgentResult(completed.model, completed.code, completed.warning)
    }

    const candidates = parseKeywordCandidates(completed.text)
    if (candidates.length === 0) {
      return failedAgentResult(completed.model, 'EMPTY_RESPONSE', 'No keyword candidates parsed')
    }

    const existing = new Set(product.keywords.map((entry) => entry.toLowerCase()))
    const suggestions = candidates
      .filter((entry) => !existing.has(entry.keyword.toLowerCase()))
      .map((entry, index) =>
        createSuggestion({
          id: `sug_keyword_${index}_${entry.intent.toLowerCase()}`,
          title: `关键词 · ${entry.intent}`,
          description: `${entry.reason} (intent ${entry.intent})`,
          risk: 'LOW',
          patches: [
            createPatch({
              action: 'INSERT',
              target: 'product.keywords',
              newValue: entry.keyword,
              source: 'AI_GENERATED',
              confidence: entry.confidence,
            }),
          ],
        }),
      )

    return {
      success: true,
      suggestions,
      warnings: [],
      metadata: { model: completed.model, tokens: completed.tokens },
    }
  }
}
