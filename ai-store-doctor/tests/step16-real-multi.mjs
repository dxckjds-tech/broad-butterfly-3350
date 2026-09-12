#!/usr/bin/env node
/**
 * Live multi-provider orchestration. Offline-safe when keys are missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadContentScripts, mockChrome } from './lib/load-content.mjs'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deepseekKey = process.env.DEEPSEEK_API_KEY || ''
const openaiKey = process.env.OPENAI_API_KEY || ''
const kimiKey = process.env.KIMI_API_KEY || ''

function collectFixture(file, url) {
  const html = fs.readFileSync(path.join(root, 'tests/fixtures', file), 'utf8')
  const dom = new JSDOM(html, { url: url, pretendToBeVisual: true, runScripts: 'outside-only' })
  mockChrome(dom.window)
  loadContentScripts(dom.window, root)
  return dom.window.collectDualTrack()
}

function loadAnalyze(settings) {
  const sandbox = {
    ASD: {},
    console: console,
    fetch: fetch,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    crypto: crypto,
    AbortController: AbortController,
    chrome: {
      storage: {
        local: {
          get: async function () {
            return Object.assign({}, settings)
          },
        },
        onChanged: { addListener: function () {} },
      },
    },
  }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  ;[
    'shared/constants.js',
    'shared/error-codes.js',
    'shared/storage-keys.js',
    'shared/pii-patterns.js',
    'shared/sanitize.js',
    'shared/result-schema.js',
    'shared/orchestration-schemas.js',
    'shared/task-types.js',
    'shared/task-validators.js',
    'shared/provider-registry.js',
    'shared/provider-configs.js',
    'shared/model-capabilities.js',
    'shared/task-profiles.js',
    'shared/model-pricing.js',
    'shared/image-score.js',
    'shared/health-score.js',
    'background/settings.js',
    'background/providers/openai-compatible.js',
    'background/providers/anthropic.js',
    'background/providers/gemini.js',
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
    'background/payload-builder.js',
    'background/image-fetcher.js',
    'background/ai-client.js',
    'background/orchestrator.js',
    'background/request-registry.js',
    'background/message-handler.js',
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  return sandbox
}

function providerConfigs(map, orch) {
  const bundle = {
    activeMode: 'auto',
    costPreference: 'balanced',
    orchestrationMode: orch || 'auto',
    configs: {},
  }
  Object.keys(map).forEach(function (id) {
    bundle.configs[id] = Object.assign({ enabled: true, participateInAuto: true, apiKey: '', model: '', baseUrl: '' }, map[id])
  })
  return bundle
}

const samples = [
  { id: 'mic-01', file: '01-mic-product-detail.html', url: 'https://sample.made-in-china.com/product/canister-vacuum-cleaner-20l.html', expect: 'vacuum|cleaner|canister' },
  { id: 'mic-05', file: '05-special-jsonld-iframe.html', url: 'https://sample.made-in-china.com/product/special.html', expect: '.' },
  { id: 'vemic-02', file: '02-vemic-product-edit.html', url: 'https://sample.vemic.com/product/edit?id=8823910', expect: 'vacuum|cleaner|steam|valve|product' },
  { id: 'dyn-04', file: '04-dynamic-product-page.html', url: 'https://sample.vemic.com/product/dynamic', expect: '.' },
]

const onlyDeepseek = loadAnalyze({
  provider: 'deepseek',
  deepseekApiKey: deepseekKey || 'placeholder',
  providerConfigs: providerConfigs(
    { deepseek: { apiKey: deepseekKey || 'placeholder', model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' } },
    'auto',
  ),
})
const onlyPlan = onlyDeepseek.ASD.bg.orchestrationPlanner.build({
  settings: { providerConfigs: providerConfigs({ deepseek: { apiKey: deepseekKey || 'placeholder', model: 'deepseek-v4-flash' } }, 'auto') },
  hasImages: true,
})

const results = {
  ok: true,
  onlyDeepseekMode: onlyPlan.mode,
  keys: { deepseek: !!deepseekKey, openai: !!openaiKey, kimi: !!kimiKey },
  cases: {},
}

if (onlyPlan.mode !== 'single') {
  results.ok = false
  results.error = 'only DeepSeek must auto-single'
}

const manufacturedRisk = onlyDeepseek.ASD.bg.verificationRisk.assessVerificationRisk({
  productBundle: { product: { specifications: [{ name: 'Power', value: '1200W' }], power: '1200W' } },
  diagnosis: {
    identity: { name: 'Demo Valve', confidence: 40 },
    facts: [
      { field: 'power', label: 'Power', value: '1500W', sourceType: 'vision', status: 'OBSERVED' },
      { field: 'material', label: 'Material', value: 'Stainless Steel', sourceType: 'vision', status: 'VERIFIED' },
    ],
  },
})
results.highRiskSample = manufacturedRisk
if (manufacturedRisk.level !== 'high') {
  results.ok = false
  results.error = (results.error ? results.error + '; ' : '') + 'manufactured high-risk sample did not trigger'
}

const secondKey = openaiKey ? { id: 'openai', apiKey: openaiKey, model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' } : kimiKey ? { id: 'moonshot', apiKey: kimiKey, model: 'kimi-k2.5', baseUrl: 'https://api.moonshot.cn/v1' } : null

if (!deepseekKey) {
  results.real = 'PENDING'
  results.reason = 'DEEPSEEK_API_KEY missing'
  console.log(JSON.stringify(results, null, 2))
  process.exit(2)
}

if (!secondKey) {
  results.real = 'REAL_MULTI_PROVIDER_PENDING'
  results.reason = 'second provider key missing; auto stays single; cannot claim live multi-model orchestration'
  const singleCfg = {
    provider: 'deepseek',
    deepseekApiKey: deepseekKey,
    providerConfigs: providerConfigs(
      { deepseek: { apiKey: deepseekKey, model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' } },
      'auto',
    ),
  }
  for (const sample of samples.filter(function (item) { return item.id === 'mic-01' || item.id === 'mic-05' || item.id === 'vemic-02' || item.id === 'dyn-04' })) {
    try {
      const bundle = collectFixture(sample.file, sample.url)
      const sandbox = loadAnalyze(singleCfg)
      const started = Date.now()
      const out = await sandbox.ASD.bg.messageHandler.handle({
        type: 'ANALYZE_PRODUCT',
        fields: bundle.fields,
        product: bundle.product,
        requestId: 'orch_single_' + sample.id,
        fieldsVersion: 1,
      })
      if (!out || !out.ok) throw new Error((out && out.reason) || 'ANALYZE failed')
      const health = sandbox.ASD.healthScore.compute(bundle.product, out.result)
      results.cases[sample.id] = {
        mode: out.orchestration && out.orchestration.mode,
        totalCalls: out.orchestration && out.orchestration.totalCalls,
        totalDurationMs: (out.orchestration && out.orchestration.totalDurationMs) || Date.now() - started,
        stages: (out.orchestration && out.orchestration.stages) || [],
        models: ((out.orchestration && out.orchestration.stages) || []).map(function (item) { return item.model }),
        fallback: !!(out.orchestration && out.orchestration.fallbackUsed),
        tokens: out.orchestration && out.orchestration.usage,
        cost: out.orchestration && out.orchestration.cost,
        riskScore: out.orchestration && (out.orchestration.riskScore != null ? out.orchestration.riskScore : out.orchestration.verification && out.orchestration.verification.riskScore),
        verification: out.orchestration && out.orchestration.verification,
        identity: out.result.summary && out.result.summary.identity,
        facts: (out.result.facts || []).length,
        health: health.total,
        contentTitles: ((out.result.content && out.result.content.titles) || []).length,
      }
    } catch (error) {
      results.ok = false
      results.cases[sample.id] = { error: error.message || String(error) }
    }
  }
  console.log(JSON.stringify(results, null, 2))
  if (!results.ok) process.exit(1)
  process.exit(0)
}

const cfg = {
  provider: 'deepseek',
  deepseekApiKey: deepseekKey,
  providerConfigs: providerConfigs(
    {
      deepseek: { apiKey: deepseekKey, model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' },
      [secondKey.id]: { apiKey: secondKey.apiKey, model: secondKey.model, baseUrl: secondKey.baseUrl },
    },
    'auto',
  ),
}

for (const sample of samples) {
  try {
    const bundle = collectFixture(sample.file, sample.url)
    const sandbox = loadAnalyze(cfg)
    const started = Date.now()
    const out = await sandbox.ASD.bg.messageHandler.handle({
      type: 'ANALYZE_PRODUCT',
      fields: bundle.fields,
      product: bundle.product,
      requestId: 'orch_' + sample.id,
      fieldsVersion: 1,
    })
    if (!out || !out.ok) throw new Error((out && out.reason) || 'ANALYZE failed')
    const schema = sandbox.ASD.schema.normalizeAndValidate(out.result)
    if (!schema.ok) throw new Error('schema ' + (schema.errors || []).join(','))
    const health = sandbox.ASD.healthScore.compute(bundle.product, out.result)
    results.cases[sample.id] = {
      mode: out.orchestration && out.orchestration.mode,
      totalCalls: out.orchestration && out.orchestration.totalCalls,
      totalDurationMs: (out.orchestration && out.orchestration.totalDurationMs) || Date.now() - started,
      stages: (out.orchestration && out.orchestration.stages) || [],
      models: ((out.orchestration && out.orchestration.stages) || []).map(function (item) { return item.model }),
      fallback: !!(out.orchestration && out.orchestration.fallbackUsed),
      tokens: out.orchestration && out.orchestration.usage,
      cost: out.orchestration && out.orchestration.cost,
      riskScore: out.orchestration && (out.orchestration.riskScore != null ? out.orchestration.riskScore : out.orchestration.verification && out.orchestration.verification.riskScore),
      verification: out.orchestration && out.orchestration.verification,
      identity: out.result.summary && out.result.summary.identity,
      facts: (out.result.facts || []).length,
      health: health.total,
      contentTitles: ((out.result.content && out.result.content.titles) || []).length,
    }
    if (out.orchestration && out.orchestration.totalCalls > 4) throw new Error('calls>4')
  } catch (error) {
    results.ok = false
    results.cases[sample.id] = { error: error.message || String(error) }
  }
}

console.log(JSON.stringify(results, null, 2))
if (!results.ok) process.exit(1)
