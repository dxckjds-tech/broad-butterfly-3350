#!/usr/bin/env node
import { loadOrch, settings, product, report, emptyEvidence } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const box = loadOrch()
const policy = box.ASD.bg.failoverPolicy
const budget = box.ASD.bg.executionBudget.create({ mode: 'balanced' })

const auth = policy.decideFailureAction({
  error: { code: 'AUTH_ERROR' },
  stage: { id: 'evidence' },
  selected: { provider: 'deepseek', model: 'deepseek-v4-flash' },
  fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini' }],
  budget: budget,
  health: box.ASD.bg.modelHealth,
  alreadyFallback: false,
})
assert(auth.action === 'fail' && auth.reason === 'auth_no_failover', 'C AUTH no fallback: ' + JSON.stringify(auth))
box.ASD.bg.modelHealth.recordFailure('deepseek', 'deepseek-v4-flash', 10, 'AUTH_ERROR')
assert(box.ASD.bg.modelHealth.get('deepseek', 'deepseek-v4-flash').needsAttention === true, 'C needsAttention')
assert(box.ASD.bg.modelHealth.providerNeedsAttention('deepseek') === true, 'C provider attention')
assert(box.ASD.bg.modelHealth.isRoutable('deepseek', 'deepseek-v4-flash', { auto: true }) === false, 'C excluded from auto')

const net = policy.decideFailureAction({
  error: { code: 'NETWORK_ERROR' },
  stage: { id: 'evidence' },
  selected: { provider: 'deepseek', model: 'deepseek-v4-flash' },
  fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini', capabilities: { text: true, structuredOutput: true } }],
  budget: budget,
  health: box.ASD.bg.modelHealth,
  alreadyFallback: false,
})
assert(net.action === 'fallback', 'D NETWORK fallback: ' + net.action)

const schema = policy.decideFailureAction({
  error: { code: 'SCHEMA_ERROR' },
  stage: { id: 'diagnosis' },
  selected: { provider: 'openai', model: 'gpt-4o' },
  fallbacks: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }],
  budget: budget,
  health: box.ASD.bg.modelHealth,
  alreadyFallback: false,
  alreadyRepaired: false,
})
assert(schema.action === 'retry_same' && schema.reason === 'schema_repair', 'E schema repair same model')

const length = policy.decideFailureAction({
  error: { code: 'LENGTH_ERROR' },
  stage: { id: 'content' },
  selected: { provider: 'openai', model: 'gpt-4o' },
  fallbacks: [{ provider: 'gemini', model: 'gemini-2.0-flash' }],
  budget: budget,
  alreadyLengthRetry: false,
})
assert(length.action === 'retry_same' && length.reason === 'raise_max_output_tokens', 'E2 length same model')

const live = loadOrch()
const tasks = []
await live.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product(),
  fields: { title: 'x', images: [] },
  settings: settings(
    {
      deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' },
      openai: { model: 'gpt-4o-mini', apiKey: 'o' },
    },
    { orchestrationMode: 'multi' },
  ),
  executeFn: async function (opts) {
    tasks.push(opts.task + ':' + opts.provider)
    if (tasks.length === 1) {
      const error = new Error('net')
      error.code = 'NETWORK_ERROR'
      throw error
    }
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    return { result: report() }
  },
})
assert(tasks.length >= 2, 'D live failover ran')
assert(tasks[0] !== tasks[1] || tasks[1].indexOf('openai') !== -1 || tasks[1].indexOf('deepseek') !== -1, 'D switched or retried')

const authLive = loadOrch()
let authCode = ''
let authCalls = 0
try {
  await authLive.ASD.bg.orchestrator.runProductDiagnosis({
    productBundle: product(),
    fields: { title: 'x' },
    settings: settings(
      {
        deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' },
        openai: { model: 'gpt-4o-mini', apiKey: 'o' },
      },
      { orchestrationMode: 'multi' },
    ),
    executeFn: async function () {
      authCalls += 1
      const error = new Error('bad key')
      error.code = 'AUTH_ERROR'
      throw error
    },
  })
} catch (error) {
  authCode = error.code
}
assert(authCode === 'AUTH_ERROR', 'C live AUTH surfaces: ' + authCode)
assert(authCalls === 1, 'C AUTH no extra model calls got ' + authCalls)
const marked = Object.keys(authLive.ASD.bg.modelHealth._providerFlags || {}).some(function (id) {
  return authLive.ASD.bg.modelHealth.providerNeedsAttention(id)
})
const anyModel = Object.keys(authLive.ASD.bg.modelHealth._store || {}).some(function (id) {
  return authLive.ASD.bg.modelHealth._store[id] && authLive.ASD.bg.modelHealth._store[id].needsAttention
})
assert(marked || anyModel, 'C health marked')

const schemaLive = loadOrch()
let schemaCalls = 0
await schemaLive.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product(),
  fields: { title: 'x' },
  settings: settings({ deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' } }, { orchestrationMode: 'single' }),
  executeFn: async function (opts) {
    schemaCalls += 1
    if (schemaCalls === 1) {
      const error = new Error('SCHEMA_ERROR:bad')
      error.code = 'SCHEMA_ERROR'
      throw error
    }
    return { result: report() }
  },
})
assert(schemaCalls === 2, 'E live same-model repair counted as call, got ' + schemaCalls)

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, C: auth, D: net, E: schema, tasks: tasks, schemaCalls: schemaCalls }))
