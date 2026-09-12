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

function runFiles(sandbox, files) {
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  files.forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  return sandbox
}

const capsBox = runFiles({ ASD: {}, console: console }, ['shared/provider-registry.js', 'shared/model-capabilities.js'])
const caps = capsBox.ASD.modelCapabilities

const k25 = caps.resolve('moonshot', 'kimi-k2.5')
assert(k25.temperature && k25.temperature.fixedValue === 1, 'kimi-k2.5 fixed temperature capability')
const forced = caps.resolveRequestTemperature(k25, 0.2)
assert(forced.send === true && forced.value === 1, 'fixed model ignores user 0.2, sends 1')

const unknown = caps.resolve('custom', 'totally-unknown-model-xyz')
assert(unknown.temperature && unknown.temperature.supported === false, 'unknown temperature unsupported')
const omitted = caps.resolveRequestTemperature(unknown, 0.7)
assert(omitted.send === false, 'unknown does not send temperature')

const gpt = caps.resolve('openai', 'gpt-4o')
assert(gpt.temperature && gpt.temperature.supported === true && gpt.temperature.fixedValue == null, 'gpt-4o adjustable')
const normal = caps.resolveRequestTemperature(gpt, 0.7)
assert(normal.send === true && normal.value === 0.7, 'adjustable uses user 0.7')

const gpt5 = caps.resolve('openai', 'gpt-5')
assert(gpt5.temperature && gpt5.temperature.fixedValue === 1, 'gpt-5 heuristic fixed 1')

function loadClient(fetchImpl, settings) {
  const sandbox = {
    ASD: { bg: {} },
    console: console,
    fetch: fetchImpl,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    AbortController: AbortController,
    Date: Date,
    Math: Math,
  }
  runFiles(sandbox, [
    'shared/constants.js',
    'shared/result-schema.js',
    'shared/task-types.js',
    'shared/task-validators.js',
    'shared/orchestration-schemas.js',
    'shared/provider-registry.js',
    'shared/provider-configs.js',
    'shared/model-capabilities.js',
    'shared/task-profiles.js',
    'background/providers/openai-compatible.js',
    'background/providers/anthropic.js',
    'background/providers/gemini.js',
    'background/provider-manager.js',
    'background/model-health.js',
    'background/model-router.js',
    'background/ai-client.js',
  ])
  sandbox.ASD.sanitize = { sanitizePayload: function (messages) { return messages } }
  sandbox.ASD.bg.settings = {
    load: async function () {
      return settings
    },
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
      temperature: extra && extra.temperature,
    },
    extra || {},
  )
}

function settingsFor(id, extra) {
  const configs = {
    deepseek: slot('deepseek', { model: 'deepseek-v4-flash', apiKey: '' }),
    moonshot: slot('moonshot', { model: 'kimi-k2.5', apiKey: '' }),
    openai: slot('openai', { model: 'gpt-4o', apiKey: '' }),
    anthropic: slot('anthropic', { model: 'claude-sonnet-4-20250514', apiKey: '' }),
    gemini: slot('gemini', { model: 'gemini-2.0-flash', apiKey: '' }),
    qwen: slot('qwen', { model: 'qwen-plus', apiKey: '' }),
    custom: slot('custom', { model: 'custom-unknown-xyz', apiKey: '' }),
  }
  Object.assign(configs[id], extra || {})
  if (!configs[id].apiKey) configs[id].apiKey = 'k-' + id
  return {
    provider: id,
    providerConfigs: {
      activeMode: 'fixed',
      fixed: { provider: id, model: configs[id].model },
      configs: configs,
    },
  }
}

async function capture(task, provider, extra, callExtra) {
  const bodies = []
  const client = loadClient(async function (url, init) {
    bodies.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async function () {
        if (task === 'translation') {
          return { choices: [{ message: { content: '{"translation":"阀"}' }, finish_reason: 'stop' }] }
        }
        if (task === 'product_diagnosis') {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: { identity: 'Valve', confidence: 80, status: 'UNKNOWN', dataCompleteness: 40, contentReadiness: 20 },
                  facts: [],
                  keywords: { current: [], blocked: [], candidates: [] },
                  content: { titles: [], detail: { headline: '', overview: '', highlights: [], specifications: [], applications: [], packagingDelivery: '', buyerNote: '' }, faq: [], geo: { headline: '', directAnswer: '', productFacts: [], companyContext: '', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: [] } },
                  debug: { missingFields: [], warnings: [] },
                }),
              },
              finish_reason: 'stop',
            }],
          }
        }
        if (task === 'fact_verification') {
          return { choices: [{ message: { content: '{"decisions":[{"claimId":"x","decision":"confirm","toStatus":"OBSERVED","reasonCode":"ok","explanation":"y"}]}' }, finish_reason: 'stop' }] }
        }
        return { choices: [{ message: { content: '{"ok":true,"message":"连接成功"}' }, finish_reason: 'stop' }] }
      },
    }
  }, settingsFor(provider, extra))
  await client.ASD.bg.aiClient.callAI(Object.assign({
    task: task,
    provider: provider,
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 64,
  }, callExtra || {}))
  return bodies[0]
}

const fixedBody = await capture('connection_test', 'moonshot', { model: 'kimi-k2.5', apiKey: 'mk', temperature: 0.2 }, { temperature: 0.2 })
assert(fixedBody.temperature === 1, 'A connection_test fixed model user 0.2 → 1, got ' + fixedBody.temperature)

const diagFixed = await capture('product_diagnosis', 'moonshot', { model: 'kimi-k2.5', apiKey: 'mk', temperature: 0.2 }, { temperature: 0.2 })
assert(diagFixed.temperature === 1, 'A product_diagnosis fixed model still 1')

const transFixed = await capture('translation', 'moonshot', { model: 'kimi-k2.5', apiKey: 'mk', temperature: 0.2 }, { temperature: 0.2 })
assert(transFixed.temperature === 1, 'A translation fixed model still 1')

const verifyFixed = await capture('fact_verification', 'moonshot', { model: 'kimi-k2.5', apiKey: 'mk', temperature: 0.2 }, { temperature: 0.2 })
assert(verifyFixed.temperature === 1, 'A verifier fixed model still 1')

const unsupportedBody = await capture('connection_test', 'custom', { model: 'custom-unknown-xyz', apiKey: 'ck', temperature: 0.2 }, { temperature: 0.2 })
assert(!Object.prototype.hasOwnProperty.call(unsupportedBody, 'temperature'), 'B unsupported omits temperature')

const unDiag = await capture('product_diagnosis', 'custom', { model: 'custom-unknown-xyz', apiKey: 'ck' }, { temperature: 0.9 })
assert(!Object.prototype.hasOwnProperty.call(unDiag, 'temperature'), 'B diagnosis unknown omits temperature')

const normalBody = await capture('connection_test', 'openai', { model: 'gpt-4o', apiKey: 'ok', temperature: 0.7 }, { temperature: 0.7 })
assert(normalBody.temperature === 0.7, 'C connection_test adjustable user 0.7 → 0.7, got ' + normalBody.temperature)

const normalDiag = await capture('product_diagnosis', 'openai', { model: 'gpt-4o', apiKey: 'ok' }, { temperature: 0.7 })
assert(normalDiag.temperature === 0.7, 'C product_diagnosis adjustable 0.7')

const adapterBox = runFiles({ ASD: {}, console: console, fetch: async function () {} }, [
  'shared/provider-registry.js',
  'shared/model-capabilities.js',
  'background/providers/openai-compatible.js',
  'background/providers/anthropic.js',
  'background/providers/gemini.js',
])
const oa = adapterBox.ASD.bg.providers.openaiCompatible.buildRequest({
  model: 'kimi-k2.5',
  messages: [{ role: 'user', content: 'x' }],
  maxTokens: 16,
  temperature: 0.2,
  capabilities: k25,
})
assert(oa.temperature === 1, 'adapter openai-compatible fixed=1')

const oaUnknown = adapterBox.ASD.bg.providers.openaiCompatible.buildRequest({
  model: 'mystery',
  messages: [{ role: 'user', content: 'x' }],
  maxTokens: 16,
  temperature: 0.2,
  capabilities: unknown,
})
assert(!Object.prototype.hasOwnProperty.call(oaUnknown, 'temperature'), 'adapter omits unsupported')

const gem = adapterBox.ASD.bg.providers.gemini.buildRequest({
  model: 'gemini-2.0-flash',
  messages: [{ role: 'user', content: 'x' }],
  maxTokens: 16,
  temperature: 0.7,
  capabilities: gpt,
})
assert(gem.generationConfig.temperature === 0.7, 'gemini adjustable 0.7')

const gemUnknown = adapterBox.ASD.bg.providers.gemini.buildRequest({
  model: 'mystery',
  messages: [{ role: 'user', content: 'x' }],
  maxTokens: 16,
  temperature: 0.2,
  capabilities: unknown,
})
assert(!Object.prototype.hasOwnProperty.call(gemUnknown.generationConfig, 'temperature'), 'gemini omits unsupported')

const anth = adapterBox.ASD.bg.providers.anthropic.buildRequest({
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'x' }],
  maxTokens: 16,
  temperature: 0.7,
  capabilities: caps.resolve('anthropic', 'claude-sonnet-4-20250514'),
})
assert(anth.temperature === 0.7, 'anthropic adjustable 0.7')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({
  ok: true,
  fixed: forced.value,
  unknownSend: omitted.send,
  adjustable: normal.value,
  connection: { kimi: fixedBody.temperature, custom: Object.prototype.hasOwnProperty.call(unsupportedBody, 'temperature'), gpt4o: normalBody.temperature },
}))
