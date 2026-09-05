import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const ORCH_FILES = [
  'shared/constants.js',
  'shared/error-codes.js',
  'shared/result-schema.js',
  'shared/orchestration-schemas.js',
  'shared/task-types.js',
  'shared/task-validators.js',
  'shared/provider-registry.js',
  'shared/provider-configs.js',
  'shared/model-capabilities.js',
  'shared/task-profiles.js',
  'shared/model-pricing.js',
  'background/provider-manager.js',
  'background/model-health.js',
  'background/execution-budget.js',
  'background/token-accounting.js',
  'background/failover-policy.js',
  'background/model-router.js',
  'background/orchestration-planner.js',
  'background/prompt-builder.js',
  'background/prompts/shared-fragments.js',
  'background/prompts/evidence-prompt.js',
  'background/prompts/diagnosis-prompt.js',
  'background/prompts/content-prompt.js',
  'background/prompts/verification-prompt.js',
  'background/verification-risk.js',
  'background/final-report-guard.js',
  'shared/payload-compactor.js',
  'background/payload-builder.js',
  'background/orchestrator.js',
  'shared/storage-keys.js',
  'shared/pii-patterns.js',
  'shared/sanitize.js',
  'sidepanel/history-store.js',
]

export function loadOrch(extraFiles) {
  const mem = {}
  const sandbox = {
    ASD: {},
    console: console,
    Date: Date,
    Math: Math,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    crypto: crypto,
    AbortController: AbortController,
    chrome: {
      storage: {
        local: {
          get: async function (keys) {
            if (typeof keys === 'string') {
              const out = {}
              out[keys] = mem[keys]
              return out
            }
            return Object.assign({}, mem)
          },
          set: async function (obj) {
            Object.assign(mem, obj)
          },
          remove: async function () {},
        },
      },
    },
  }
  sandbox.globalThis = sandbox
  sandbox.globalThis.chrome = sandbox.chrome
  const ctx = vm.createContext(sandbox)
  ORCH_FILES.concat(extraFiles || []).forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  return sandbox
}

export function slot(id, extra) {
  return Object.assign(
    {
      enabled: true,
      participateInAuto: true,
      apiKey: extra && extra.apiKey != null ? extra.apiKey : 'key-' + id,
      baseUrl: 'https://example.test/' + id,
      model: extra && extra.model,
      scoreOverride: extra && extra.scoreOverride,
    },
    extra || {},
  )
}

export function settings(map, extras) {
  const configs = {
    deepseek: slot('deepseek', { model: 'deepseek-v4-flash', apiKey: '' }),
    moonshot: slot('moonshot', { model: 'kimi-k2.5', apiKey: '' }),
    openai: slot('openai', { model: 'gpt-4o-mini', apiKey: '' }),
    anthropic: slot('anthropic', { model: 'claude-sonnet-4-20250514', apiKey: '' }),
    gemini: slot('gemini', { model: 'gemini-2.0-flash', apiKey: '' }),
    qwen: slot('qwen', { model: 'qwen-plus', apiKey: '' }),
    custom: slot('custom', { model: 'x', apiKey: '' }),
  }
  Object.keys(map || {}).forEach(function (id) {
    Object.assign(configs[id], map[id])
  })
  return {
    provider: 'deepseek',
    providerConfigs: Object.assign(
      { activeMode: 'auto', costPreference: 'balanced', orchestrationMode: 'auto', configs: configs },
      extras || {},
    ),
  }
}

export function threeQuality(extra) {
  return settings(
    {
      gemini: {
        model: 'gemini-2.0-flash',
        apiKey: 'g',
        scoreOverride: { quality: { vision: 99, reasoning: 40, writing: 40, jsonReliability: 80 }, reliability: 80, speed: 80, cost: 70 },
      },
      anthropic: {
        model: 'claude-sonnet-4-20250514',
        apiKey: 'a',
        scoreOverride: { quality: { vision: 40, reasoning: 99, writing: 55, jsonReliability: 88 }, reliability: 86, speed: 74, cost: 45 },
      },
      openai: {
        model: 'gpt-4o',
        apiKey: 'o',
        scoreOverride: { quality: { vision: 50, reasoning: 55, writing: 99, jsonReliability: 90 }, reliability: 88, speed: 80, cost: 55 },
      },
    },
    Object.assign({ orchestrationMode: 'multi', costPreference: 'quality' }, extra || {}),
  )
}

export function product(power) {
  return {
    product: {
      name: 'DN50 Ball Valve',
      category: 'Valves',
      specifications: [
        { name: 'Material', value: 'Stainless Steel' },
        { name: 'Power', value: power || '1200W' },
      ],
      power: power || '1200W',
    },
    current: { title: 'DN50 Ball Valve', keywords: ['ball valve'], description: 'Industrial valve' },
    company: { name: 'Acme', profile: 'Factory' },
  }
}

export function report(extra) {
  return Object.assign(
    {
      summary: { identity: 'DN50 Ball Valve', confidence: 80, status: 'VERIFIED', dataCompleteness: 70, contentReadiness: 70 },
      facts: [{ label: 'Material', value: 'Stainless Steel', status: 'VERIFIED', source: 'spec', sourceType: 'spec_table' }],
      keywords: { current: ['ball valve'], blocked: [], candidates: [] },
      content: {
        titles: [{ text: 'DN50 Stainless Steel Ball Valve', style: 'spec', factsUsed: ['Material'], excluded: [] }],
        detail: { headline: 'Ball Valve', overview: 'Industrial ball valve', highlights: [], specifications: [], applications: [], packagingDelivery: '', buyerNote: '' },
        faq: [],
        geo: { headline: 'Ball valve', directAnswer: 'A DN50 ball valve', productFacts: ['Stainless Steel'], companyContext: 'Acme', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: ['title'] },
      },
      debug: { missingFields: [], warnings: [] },
    },
    extra || {},
  )
}

export function highRiskDiagnosis() {
  return {
    summary: 'conflict',
    identity: { name: 'DN50 Ball Valve', confidence: 40 },
    facts: [
      { label: 'Power', field: 'power', value: '1500W', status: 'OBSERVED', sourceType: 'vision', sourceRef: 'img' },
      { label: 'Material', field: 'material', value: 'Stainless Steel', status: 'VERIFIED', sourceType: 'vision', sourceRef: 'img' },
    ],
    diagnosis: { strengths: [], issues: ['power conflict'], priorities: [] },
    keywordStrategy: { primary: [], secondary: [], blocked: [], rationale: [] },
    contentBrief: { titleGoals: [], detailGoals: [], faqGoals: [], geoGoals: [] },
  }
}

export function emptyEvidence() {
  return { identityCandidates: [{ name: 'DN50 Ball Valve', confidence: 40, evidence: ['title'] }], evidence: [], imageObservations: [], unknowns: [] }
}
