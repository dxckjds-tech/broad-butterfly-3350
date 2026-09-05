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

function load() {
  const sandbox = { ASD: {}, console: console, Date: Date, Math: Math }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  ;[
    'shared/constants.js',
    'shared/provider-registry.js',
    'shared/provider-configs.js',
    'shared/model-capabilities.js',
    'shared/task-profiles.js',
    'background/provider-manager.js',
    'background/model-health.js',
    'background/model-router.js',
    'background/orchestration-planner.js',
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
  })
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
      capabilitiesOverride: extra && extra.caps,
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
      {
        activeMode: 'auto',
        costPreference: 'balanced',
        orchestrationMode: 'auto',
        configs: configs,
      },
      extras || {},
    ),
  }
}

const A = load()
const one = A.ASD.bg.orchestrationPlanner.build({
  settings: settings({ deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' } }),
  hasImages: false,
})
assert(one.ok && one.mode === 'single' && one.estimatedCalls === 1, 'A one provider → single')

const B = load()
const two = B.ASD.bg.orchestrationPlanner.build({
  settings: settings({
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
  }, { orchestrationMode: 'multi', costPreference: 'balanced' }),
  hasImages: true,
})
assert(two.ok && two.mode === 'multi', 'B multi')
assert(two.estimatedCalls === 2, 'B merge diagnosis+content, calls=2 got ' + two.estimatedCalls)
const bEvidence = two.stages.find(function (s) { return (s.covers || []).indexOf('evidence') !== -1 })
const bDiag = two.stages.find(function (s) { return (s.covers || []).indexOf('diagnosis') !== -1 })
assert(bEvidence && bEvidence.provider === 'gemini', 'B stage1=gemini got ' + (bEvidence && bEvidence.provider))
assert(bDiag && bDiag.provider === 'anthropic', 'B stage2=anthropic')
assert((bDiag.covers || []).indexOf('content') !== -1, 'B stage2+3 merged')

const C = load()
const three = C.ASD.bg.orchestrationPlanner.build({
  settings: settings({
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
  }, { orchestrationMode: 'multi', costPreference: 'quality' }),
  hasImages: true,
})
assert(three.ok && three.estimatedCalls === 3, 'C three calls got ' + three.estimatedCalls)
assert(three.stages[0].provider === 'gemini', 'C evidence gemini')
assert(three.stages[1].provider === 'anthropic', 'C diagnosis anthropic got ' + (three.stages[1] && three.stages[1].provider))
assert(three.stages[2].provider === 'openai', 'C content openai got ' + (three.stages[2] && three.stages[2].provider))

const D = load()
const eco = D.ASD.bg.orchestrationPlanner.build({
  settings: settings({
    deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' },
    openai: { model: 'gpt-4o', apiKey: 'o' },
  }, { orchestrationMode: 'auto', costPreference: 'economy' }),
  hasImages: false,
})
assert(eco.ok && eco.mode === 'single', 'D economy no-image single cheap model')

const H = load()
const merged = H.ASD.bg.orchestrationPlanner.mergeAdjacent([
  { id: 'diagnosis', provider: 'openai', model: 'gpt-4o', covers: ['diagnosis'], capabilities: { structuredOutput: true, text: true } },
  { id: 'content', provider: 'openai', model: 'gpt-4o', covers: ['content'], capabilities: { structuredOutput: true, text: true } },
])
assert(merged.length === 1 && merged[0].mergedWith === 'content', 'H same model must merge')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, A: one.mode, B: two.estimatedCalls, C: three.estimatedCalls, D: eco.mode, H: merged[0].id }))
