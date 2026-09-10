/**
 * v0.3.0 Step 4 — Agent layer.
 *
 * Agents emit PENDING suggestions only. Nothing here writes the page.
 */
import { describe, expect, it } from 'vitest'
import {
  ContentAgent,
  KeywordAgent,
  ProductIdentityAgent,
  VerificationAgent,
  inspectSuggestion,
  parseKeywordCandidates,
  softenKeywordReason,
  stripInventedCerts,
} from '../src/ai/agents'
import type { AgentContext, MicAgent } from '../src/ai/agents/types'
import { AgentOrchestrator, DEFAULT_AGENT_ORDER } from '../src/ai/orchestrator'
import { resolveProvider } from '../src/ai/providers/agentProvider'
import { createScriptedProvider } from '../src/ai/providers/scriptedProvider'
import { capabilitiesForProvider } from '../src/ai/providers/catalog'
import { applySuggestion, createSuggestion } from '../src/ai/protocol/suggestion'
import { createPatch } from '../src/ai/protocol/patch'
import { emptyMICPageSchema } from '../src/mic/schema/page'
import type { MICPageSchema } from '../src/mic/schema/page'
import type { ProviderAssignmentMap } from '../src/ai/providers/types'

function pageWithVacuum(): MICPageSchema {
  const page = emptyMICPageSchema()
  page.product.productName = 'Portable Vacuum'
  page.product.category = 'Home Appliances'
  page.product.keywords = ['vacuum']
  page.product.description = 'A handheld vacuum.'
  page.product.specifications = [{ name: 'Voltage', value: '220V' }]
  page.product.certifications = ['CE']
  page.product.images = [
    { id: 'img1', url: 'https://cdn.example.com/vac.jpg', type: 'main', order: 0, source: 'PAGE' },
  ]
  page.product.companyProfile = 'OEM factory in Ningbo.'
  page.company.name = 'Ningbo Example Co., Ltd.'
  page.company.certifications = []
  return page
}

function context(product = pageWithVacuum()): AgentContext {
  return { product, images: product.product.images, task: 'optimize-mic-listing' }
}

function assignments(overrides: ProviderAssignmentMap = {}): ProviderAssignmentMap {
  return {
    vision: { provider: 'gemini', model: 'user-vision-model' },
    keyword: { provider: 'deepseek', model: 'user-keyword-model' },
    content: { provider: 'openai', model: 'user-content-model' },
    verification: { provider: 'claude', model: 'user-verify-model' },
    ...overrides,
  }
}

describe('Agent interface', () => {
  it('every agent exposes run(context)', async () => {
    const map = assignments()
    const providers = [
      createScriptedProvider({
        id: 'gemini',
        model: 'user-vision-model',
        capabilities: capabilitiesForProvider('gemini'),
        handler: async () => ({
          ok: true,
          model: 'user-vision-model',
          text: '{"productType":"vacuum","confidence":0.8,"possibleCategory":"Vacuum Cleaner"}',
        }),
      }),
      createScriptedProvider({
        id: 'deepseek',
        model: 'user-keyword-model',
        capabilities: capabilitiesForProvider('deepseek'),
        handler: async () => ({
          ok: true,
          model: 'user-keyword-model',
          text: '[]',
        }),
      }),
      createScriptedProvider({
        id: 'openai',
        model: 'user-content-model',
        capabilities: capabilitiesForProvider('openai'),
        handler: async () => ({ ok: true, model: 'user-content-model', text: '{}' }),
      }),
      createScriptedProvider({
        id: 'claude',
        model: 'user-verify-model',
        capabilities: capabilitiesForProvider('claude'),
        handler: async () => ({ ok: true, model: 'user-verify-model', text: '{"status":"PASS"}' }),
      }),
    ]
    const agents: MicAgent[] = [
      new ProductIdentityAgent(map, providers),
      new KeywordAgent(map, providers),
      new ContentAgent(map, providers),
      new VerificationAgent(map, providers),
    ]
    for (const agent of agents) {
      expect(typeof agent.run).toBe('function')
      const result = await agent.run(context())
      expect(result).toHaveProperty('success')
      expect(Array.isArray(result.suggestions)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(result.metadata).toHaveProperty('model')
    }
  })
})

describe('Vision capability check', () => {
  it('returns ROLE_CAPABILITY_MISMATCH when a text-only brand is assigned to vision', async () => {
    const map = assignments({ vision: { provider: 'deepseek', model: 'r1' } })
    const providers = [
      createScriptedProvider({
        id: 'deepseek',
        model: 'r1',
        capabilities: capabilitiesForProvider('deepseek'),
        handler: async () => ({ ok: true, model: 'r1', text: '{}' }),
      }),
    ]
    const resolved = resolveProvider({ capability: 'vision', assignments: map, providers })
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.code).toBe('ROLE_CAPABILITY_MISMATCH')

    const agent = new ProductIdentityAgent(map, providers)
    const result = await agent.run(context())
    expect(result.success).toBe(false)
    expect(result.metadata.failure).toBe('ROLE_CAPABILITY_MISMATCH')
    expect(result.suggestions).toEqual([])
  })

  it('does not swap in another brand when vision is missing', () => {
    const resolved = resolveProvider({
      capability: 'vision',
      assignments: {},
      providers: [
        createScriptedProvider({
          id: 'openai',
          model: 'anything',
          capabilities: capabilitiesForProvider('openai'),
          handler: async () => ({ ok: true, model: 'anything', text: 'nope' }),
        }),
      ],
    })
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.code).toBe('MODEL_UNAVAILABLE')
  })
})

describe('Keyword rules', () => {
  it('softens search-volume claims and keeps three intents', async () => {
    expect(softenKeywordReason('搜索量最高的词')).toMatch(/常见|可能|行业惯用/)
    const parsed = parseKeywordCandidates(
      JSON.stringify([
        { keyword: 'vacuum cleaner', intent: 'GENERIC', reason: '核心产品通用词', confidence: 0.9 },
        { keyword: 'cordless vacuum', intent: 'ATTRIBUTE', reason: '属性+产品词', confidence: 0.8 },
        { keyword: 'handheld vacuum for car', intent: 'LONG_TAIL', reason: '搜索量最高', confidence: 0.7 },
      ]),
    )
    expect(parsed.map((entry) => entry.intent)).toEqual(['GENERIC', 'ATTRIBUTE', 'LONG_TAIL'])
    expect(parsed[2]?.reason).not.toMatch(/搜索量最高/)

    const map = assignments()
    const providers = [
      createScriptedProvider({
        id: 'deepseek',
        model: 'user-keyword-model',
        capabilities: capabilitiesForProvider('deepseek'),
        handler: async () => ({
          ok: true,
          model: 'user-keyword-model',
          text: JSON.stringify(parsed),
        }),
      }),
    ]
    const result = await new KeywordAgent(map, providers).run(context())
    expect(result.success).toBe(true)
    expect(result.suggestions.every((entry) => entry.status === 'PENDING')).toBe(true)
    expect(result.suggestions.some((entry) => entry.description.includes('LONG_TAIL'))).toBe(true)
  })
})

describe('External parameters', () => {
  it('marks specs that are not on the page as EXTERNAL_REFERENCE', async () => {
    const map = assignments()
    const providers = [
      createScriptedProvider({
        id: 'openai',
        model: 'user-content-model',
        capabilities: capabilitiesForProvider('openai'),
        handler: async () => ({
          ok: true,
          model: 'user-content-model',
          text: JSON.stringify({
            description: 'A handheld vacuum. CE certified. ISO99999 factory.',
            companyProfile: 'OEM factory in Ningbo.',
            faq: [{ question: 'Is it cordless?', answer: 'Yes, based on the listing title.' }],
            specifications: [{ name: 'Noise', value: '65dB' }],
          }),
        }),
      }),
    ]
    const result = await new ContentAgent(map, providers).run(context())
    expect(result.success).toBe(true)
    const spec = result.suggestions.find((entry) => entry.id.startsWith('sug_content_spec_'))
    expect(spec).toBeTruthy()
    expect(spec?.patches[0]?.source).toBe('EXTERNAL_REFERENCE')
    expect(spec?.patches[0]?.needConfirm).toBe(true)
    const description = result.suggestions.find((entry) => entry.id === 'sug_content_description')
    expect(String(description?.patches[0]?.newValue ?? '')).not.toMatch(/ISO99999/)
    expect(String(description?.patches[0]?.newValue ?? '')).toMatch(/CE/)
  })
})

describe('Verification intercept', () => {
  it('blocks invented certifications and keeps EXTERNAL_REFERENCE as WARNING', () => {
    const ctx = context()
    const invented = createSuggestion({
      title: 'Add fake cert',
      description: 'invented',
      risk: 'HIGH',
      patches: [
        createPatch({
          action: 'INSERT',
          target: 'product.certifications',
          newValue: 'ISO99999',
          source: 'AI_GENERATED',
          confidence: 0.3,
        }),
      ],
    })
    const external = createSuggestion({
      title: 'External spec',
      description: 'from web',
      risk: 'HIGH',
      patches: [
        createPatch({
          action: 'INSERT',
          target: 'product.specifications',
          newValue: { name: 'Noise', value: '65dB' },
          source: 'EXTERNAL_REFERENCE',
          confidence: 0.3,
        }),
      ],
    })
    expect(inspectSuggestion(ctx, invented).status).toBe('BLOCKED')
    expect(inspectSuggestion(ctx, external).status).toBe('WARNING')
  })

  it('drops BLOCKED suggestions from the agent result', async () => {
    const map = assignments()
    const providers = [
      createScriptedProvider({
        id: 'claude',
        model: 'user-verify-model',
        capabilities: capabilitiesForProvider('claude'),
        handler: async () => ({ ok: true, model: 'user-verify-model', text: '{"status":"PASS"}' }),
      }),
    ]
    const invented = createSuggestion({
      id: 'sug_fake_cert',
      title: 'fake',
      description: 'fake',
      patches: [
        createPatch({
          action: 'INSERT',
          target: 'product.certifications',
          newValue: 'ISO99999',
          source: 'AI_GENERATED',
        }),
      ],
    })
    const result = await new VerificationAgent(map, providers).run({
      ...context(),
      suggestions: [invented],
    })
    expect(result.suggestions.find((entry) => entry.id === 'sug_fake_cert')).toBeUndefined()
    expect(result.metadata.verification).toBe('BLOCKED')
    expect(result.warnings.some((line) => /ISO99999/.test(line))).toBe(true)
  })
})

describe('Orchestrator flow', () => {
  it('runs identity → keyword → content → verification and never applies', async () => {
    const order: string[] = []
    const map = assignments()
    const providers = [
      createScriptedProvider({
        id: 'gemini',
        model: 'user-vision-model',
        capabilities: capabilitiesForProvider('gemini'),
        handler: async () => {
          order.push('identity')
          return {
            ok: true,
            model: 'user-vision-model',
            text: '{"productType":"vacuum","confidence":0.81,"possibleCategory":"Vacuum Cleaner"}',
          }
        },
      }),
      createScriptedProvider({
        id: 'deepseek',
        model: 'user-keyword-model',
        capabilities: capabilitiesForProvider('deepseek'),
        handler: async () => {
          order.push('keyword')
          return {
            ok: true,
            model: 'user-keyword-model',
            text: JSON.stringify([
              { keyword: 'vacuum cleaner', intent: 'GENERIC', reason: '核心产品通用词', confidence: 0.9 },
            ]),
          }
        },
      }),
      createScriptedProvider({
        id: 'openai',
        model: 'user-content-model',
        capabilities: capabilitiesForProvider('openai'),
        handler: async () => {
          order.push('content')
          return {
            ok: true,
            model: 'user-content-model',
            text: JSON.stringify({ description: 'A handheld vacuum.', companyProfile: '', faq: [], specifications: [] }),
          }
        },
      }),
      createScriptedProvider({
        id: 'claude',
        model: 'user-verify-model',
        capabilities: capabilitiesForProvider('claude'),
        handler: async () => {
          order.push('verification')
          return { ok: true, model: 'user-verify-model', text: '{"status":"PASS"}' }
        },
      }),
    ]

    const product = pageWithVacuum()
    const snapshot = product.product.productName
    const orchestrator = new AgentOrchestrator({ assignments: map, providers })
    expect(orchestrator.agents().map((agent) => agent.id)).toEqual([...DEFAULT_AGENT_ORDER])

    const result = await orchestrator.run(context(product))
    expect(result.steps.map((step) => step.id)).toEqual([...DEFAULT_AGENT_ORDER])
    expect(order).toEqual(['identity', 'keyword', 'content', 'verification'])
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions.every((entry) => entry.status === 'PENDING')).toBe(true)
    expect(product.product.productName).toBe(snapshot)
    expect(applySuggestion(product, result.suggestions[0]!).ok).toBe(false)
  })
})

describe('stripInventedCerts', () => {
  it('keeps certs already on the page', () => {
    const known = new Set(['CE'])
    const result = stripInventedCerts('CE body, ISO9001 claimed', known)
    expect(result.stripped).toContain('ISO9001')
    expect(result.text).toMatch(/CE/)
    expect(result.text).not.toMatch(/ISO9001/)
  })
})
