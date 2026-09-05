#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

function load(withSanitize) {
  const sandbox = {
    ASD: {},
    console: console,
    Date: Date,
    Math: Math,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    crypto: crypto,
    AbortController: AbortController,
  }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  const files = [
    'shared/constants.js',
    'shared/result-schema.js',
    'shared/orchestration-schemas.js',
    'shared/task-types.js',
    'shared/task-validators.js',
    'shared/provider-registry.js',
    'shared/provider-configs.js',
    'shared/model-capabilities.js',
    'shared/task-profiles.js',
    'background/provider-manager.js',
    'background/model-health.js',
    'background/model-router.js',
    'background/orchestration-planner.js',
    'background/prompt-builder.js',
    'background/prompts/shared-fragments.js',
    'background/prompts/evidence-prompt.js',
    'background/prompts/diagnosis-prompt.js',
    'background/prompts/content-prompt.js',
    'background/payload-builder.js',
    'background/orchestrator.js',
    'shared/storage-keys.js',
    'shared/pii-patterns.js',
    'sidepanel/history-store.js',
  ]
  if (withSanitize) files.splice(files.indexOf('background/payload-builder.js'), 0, 'shared/sanitize.js')
  files.forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  if (withSanitize === 'stub') {
    sandbox.ASD.sanitize = {
      sanitizePayload: function (messages) { return messages },
      sanitizeCollected: function (value) { return value },
    }
  }
  return sandbox
}

function slot(id, extra) {
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

function settings(map, extras) {
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

const product = {
  product: { name: 'DN50 Ball Valve', category: 'Valves', specifications: [{ name: 'Material', value: 'Stainless Steel' }] },
  current: { title: 'DN50 Ball Valve', keywords: ['ball valve'], description: 'Industrial valve' },
  company: { name: 'Acme', profile: 'Factory' },
}

function report() {
  return {
    summary: { identity: 'DN50 Ball Valve', confidence: 80, status: 'VERIFIED', dataCompleteness: 70, contentReadiness: 70 },
    facts: [{ label: 'Material', value: 'Stainless Steel', status: 'VERIFIED', source: 'spec' }],
    keywords: { current: ['ball valve'], blocked: [], candidates: [] },
    content: {
      titles: [{ text: 'DN50 Stainless Steel Ball Valve', style: 'spec', factsUsed: ['Material'], excluded: [] }],
      detail: { headline: 'Ball Valve', overview: 'Industrial ball valve', highlights: [], specifications: [], applications: [], packagingDelivery: '', buyerNote: '' },
      faq: [],
      geo: { headline: 'Ball valve', directAnswer: 'A DN50 ball valve', productFacts: ['Stainless Steel'], companyContext: 'Acme', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: ['title'] },
    },
    debug: { missingFields: [], warnings: [] },
  }
}

const box = load('stub')
const calls = []
const single = await box.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product,
  fields: { title: 'DN50 Ball Valve', images: [] },
  settings: settings({ deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' } }, { orchestrationMode: 'single' }),
  executeFn: async function (opts) {
    calls.push(opts.task)
    return { result: report(), provider: 'DeepSeek', model: opts.model, usage: null }
  },
})
assert(single.orchestration.mode === 'single', 'A/single mode')
assert(single.orchestration.totalCalls === 1, 'A calls=1')
assert(calls.length === 1 && calls[0] === 'product_diagnosis', 'A one product_diagnosis')
assert(box.ASD.schema.normalizeAndValidate(single.result).ok, 'J final schema')

const multiBox = load('stub')
const multiCalls = []
const multi = await multiBox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product,
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/ball-valve-dn50.jpg'] },
  requestContext: { hasImages: true },
  settings: settings(
    {
      gemini: {
        model: 'gemini-2.0-flash',
        apiKey: 'g',
        scoreOverride: { quality: { vision: 99, reasoning: 40, writing: 40, jsonReliability: 80 }, reliability: 80, speed: 80, cost: 70 },
      },
      anthropic: {
        model: 'claude-sonnet-4-20250514',
        apiKey: 'a',
        scoreOverride: { quality: { vision: 40, reasoning: 99, writing: 99, jsonReliability: 88 }, reliability: 86, speed: 74, cost: 45 },
      },
    },
    { orchestrationMode: 'multi', costPreference: 'balanced' },
  ),
  executeFn: async function (opts) {
    multiCalls.push(opts.task + ':' + opts.provider)
    if (opts.task === 'evidence_analysis') {
      return {
        result: {
          identityCandidates: [{ name: 'DN50 Ball Valve', confidence: 80, evidence: ['title'] }],
          evidence: [{ field: 'material', value: 'Stainless Steel', sourceType: 'vision', status: 'OBSERVED', confidence: 70 }],
          imageObservations: [],
          unknowns: [],
        },
      }
    }
    return { result: report(), provider: opts.provider, model: opts.model }
  },
})
assert(multi.plan.estimatedCalls === 2, 'B planner 2 calls')
assert(multiCalls.length === 2, 'B execute 2 got ' + multiCalls.join(','))
assert(multi.orchestration.totalCalls === 2, 'B orchestration totalCalls')

const failBox = load('stub')
let failCalls = 0
let fallbackOk = false
try {
  await failBox.ASD.bg.orchestrator.runProductDiagnosis({
    productBundle: product,
    fields: { title: 'x', images: [] },
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' },
      openai: { model: 'gpt-4o-mini', apiKey: 'o' },
    }, { orchestrationMode: 'multi' }),
    executeFn: async function (opts) {
      failCalls += 1
      if (failCalls === 1) {
        const error = new Error('timeout')
        error.code = 'CONNECTION_ERROR'
        throw error
      }
      if (opts.task === 'evidence_analysis') {
        return { result: { identityCandidates: [], evidence: [], imageObservations: [], unknowns: [] } }
      }
      fallbackOk = true
      return { result: report() }
    },
  })
} catch (error) {
  if (error.code !== 'ORCHESTRATION_BUDGET_EXCEEDED' && error.code !== 'VALIDATION_ERROR' && error.code !== 'CONNECTION_ERROR') {
    errors.push('I unexpected ' + error.code + ' ' + error.message)
  }
}
assert(failCalls <= 4, 'I total calls <=4 got ' + failCalls)

const nosan = load(false)
let leaked = 0
let sanCode = ''
try {
  await nosan.ASD.bg.orchestrator.runProductDiagnosis({
    productBundle: product,
    fields: { title: 'x' },
    settings: settings({ deepseek: { apiKey: 'ds', model: 'deepseek-v4-flash' } }),
    executeFn: async function () {
      leaked += 1
      return { result: report() }
    },
  })
} catch (error) {
  sanCode = error.code || error.message
}
assert(sanCode === 'SECURITY_SANITIZER_UNAVAILABLE', 'L sanitizer fail-closed: ' + sanCode)
assert(leaked === 0, 'L must not call provider')

const histBox = load('stub')
histBox.chrome = {
  storage: {
    local: {
      mem: {},
      get: async function (keys) {
        const out = {}
        out[keys] = histBox.chrome.storage.local.mem[keys]
        return out
      },
      set: async function (obj) {
        Object.assign(histBox.chrome.storage.local.mem, obj)
      },
      remove: async function () {},
    },
  },
}
histBox.globalThis.chrome = histBox.chrome
const stored = await histBox.ASD.sidepanel.historyStore.put({
  productName: 'Valve',
  report: report(),
  product: product,
  orchestration: {
    mode: 'multi',
    totalCalls: 2,
    stages: [{ stage: 'evidence', provider: 'gemini', model: 'gemini-2.0-flash' }],
    raw: { secret: 'nope' },
    prompt: 'FULL PROMPT',
    messages: [{ role: 'user', content: 'x' }],
  },
  reportExtra: { raw: 'stage-raw', prompt: 'p', images: ['data:image/png;base64,AAAA'] },
})
const dumped = JSON.stringify(stored)
assert(stored.orchestration && stored.orchestration.mode === 'multi', 'K orchestration kept')
assert(dumped.indexOf('FULL PROMPT') === -1, 'K prompt stripped')
assert(dumped.indexOf('data:image/png') === -1, 'K base64 stripped')
assert(dumped.indexOf('stage-raw') === -1 || !stored.orchestration.raw, 'K raw not stored on orchestration')
assert(!stored.orchestration.prompt && !stored.orchestration.messages, 'K no prompt/messages')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    A: single.orchestration,
    Bcalls: multiCalls,
    Icalls: failCalls,
    J: true,
    K: true,
    L: sanCode,
  }),
)
