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
      apiKey: 'key-' + id,
      baseUrl: 'https://example.test/' + id,
      model: extra && extra.model,
      capabilitiesOverride: extra && extra.caps,
    },
    extra || {},
  )
}

function settings(map, extras) {
  const configs = {
    deepseek: slot('deepseek', { model: 'deepseek-v4-flash' }),
    moonshot: slot('moonshot', { model: 'kimi-k2.5' }),
    openai: slot('openai', { model: 'gpt-4o-mini' }),
    anthropic: slot('anthropic', { model: 'claude-sonnet-4-20250514', apiKey: '' }),
    gemini: slot('gemini', { model: 'gemini-2.0-flash', apiKey: '' }),
    qwen: slot('qwen', { model: 'qwen-plus', apiKey: '' }),
    custom: slot('custom', { model: 'x', apiKey: '' }),
  }
  Object.keys(map || {}).forEach(function (id) {
    Object.assign(configs[id], map[id])
  })
  return Object.assign(
    {
      provider: 'deepseek',
      providerConfigs: Object.assign(
        {
          activeMode: 'auto',
          costPreference: 'balanced',
          fixed: { provider: 'deepseek', model: 'deepseek-v4-flash' },
          advanced: {},
          configs: configs,
        },
        extras || {},
      ),
    },
    extras && extras.top ? extras.top : {},
  )
}

const A = load()
const visionPick = A.ASD.bg.modelRouter.selectModel(
  'product_diagnosis',
  { hasImages: true, settings: settings() },
  { mode: 'auto', costPreference: 'balanced' },
)
assert(visionPick.ok && visionPick.selected.capabilities.vision === true, 'A must pick vision model')
assert(visionPick.selected.provider !== 'deepseek', 'A must not pick flash without vision: ' + (visionPick.selected && visionPick.selected.provider))

const B = load()
const economy = B.ASD.bg.modelRouter.selectModel(
  'translation',
  {
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash' },
      moonshot: { model: 'kimi-k2.5' },
      openai: { apiKey: '' },
    }),
  },
  { mode: 'auto', costPreference: 'economy' },
)
assert(economy.ok && economy.selected.provider === 'deepseek', 'B economy prefers cheaper DeepSeek, got ' + (economy.selected && economy.selected.provider))

const C = load()
const quality = C.ASD.bg.modelRouter.selectModel(
  'product_diagnosis',
  {
    hasImages: false,
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash' },
      openai: { model: 'gpt-4o', apiKey: 'ok' },
      moonshot: { apiKey: '' },
    }),
  },
  { mode: 'auto', costPreference: 'quality' },
)
assert(quality.ok && quality.selected.provider === 'openai', 'C quality prefers OpenAI, got ' + (quality.selected && quality.selected.provider))

const D = load()
const noKey = D.ASD.bg.modelRouter.selectModel(
  'translation',
  { settings: settings({ deepseek: { apiKey: '' }, moonshot: { apiKey: '' }, openai: { apiKey: '' } }) },
  { mode: 'auto' },
)
assert(noKey.ok === false && noKey.code === 'NO_COMPATIBLE_MODEL', 'D no key excluded')

const E = load()
const disabled = E.ASD.bg.modelRouter.selectModel(
  'translation',
  {
    settings: settings({
      deepseek: { enabled: false },
      moonshot: { enabled: false },
      openai: { apiKey: '' },
    }),
  },
  { mode: 'auto' },
)
assert(disabled.ok === false && disabled.code === 'NO_COMPATIBLE_MODEL', 'E disabled excluded')

const F = load()
const none = F.ASD.bg.modelRouter.selectModel(
  'vision_analysis',
  {
    hasImages: true,
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash' },
      moonshot: { apiKey: '' },
      openai: { apiKey: '' },
    }),
  },
  { mode: 'auto' },
)
assert(none.ok === false && none.code === 'NO_COMPATIBLE_MODEL', 'F no compatible vision model')

const G = load()
const fixed = G.ASD.bg.modelRouter.selectModel(
  'product_diagnosis',
  {
    hasImages: true,
    settings: settings(
      {},
      { activeMode: 'fixed', fixed: { provider: 'deepseek', model: 'deepseek-v4-flash' } },
    ),
  },
  { mode: 'fixed' },
)
assert(fixed.ok === false && fixed.code === 'NO_COMPATIBLE_MODEL', 'G fixed no-vision fails')
assert(fixed.suggestAuto === true, 'G suggest auto')

const textOnly = load()
const flashOnly = textOnly.ASD.bg.modelRouter.selectModel(
  'product_diagnosis',
  {
    hasImages: true,
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash' },
      moonshot: { apiKey: '' },
      openai: { apiKey: '' },
    }),
  },
  { mode: 'auto' },
)
assert(flashOnly.ok && flashOnly.selected.provider === 'deepseek', 'DeepSeek-only pages with images still route to flash')
assert(flashOnly.selected.capabilities.vision === false, 'flash remains non-vision')
assert(
  (flashOnly.reason || []).join('').indexOf('纯文本') !== -1,
  'explain text-only fallback: ' + (flashOnly.reason || []).join(','),
)

const H = load()
H.ASD.bg.modelHealth.recordFailure('deepseek', 'deepseek-v4-flash')
H.ASD.bg.modelHealth.recordFailure('deepseek', 'deepseek-v4-flash')
H.ASD.bg.modelHealth.recordFailure('deepseek', 'deepseek-v4-flash')
const penalized = H.ASD.bg.modelRouter.selectModel(
  'translation',
  {
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash' },
      moonshot: { model: 'kimi-k2.5' },
      openai: { apiKey: '' },
    }),
  },
  { mode: 'auto', costPreference: 'economy' },
)
assert(penalized.ok, 'health still selects a model')
assert(penalized.selected.provider !== 'deepseek', '3 failures downrank DeepSeek, got ' + (penalized.selected && penalized.selected.provider))
H.ASD.bg.modelHealth.recordSuccess('deepseek', 'deepseek-v4-flash', 800)
const recovered = H.ASD.bg.modelRouter.selectModel(
  'translation',
  {
    settings: settings({
      deepseek: { model: 'deepseek-v4-flash' },
      moonshot: { model: 'kimi-k2.5' },
      openai: { apiKey: '' },
    }),
  },
  { mode: 'auto', costPreference: 'economy' },
)
assert(recovered.selected.provider === 'deepseek', 'success can recover DeepSeek in economy: ' + (recovered.selected && recovered.selected.provider))

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    A: visionPick.selected.provider,
    B: economy.selected.provider,
    C: quality.selected.provider,
    D: noKey.code,
    E: disabled.code,
    F: none.code,
    G: fixed.suggestAuto,
    flashTextFallback: flashOnly.selected.provider,
    healthDownrank: penalized.selected.provider,
    healthRecover: recovered.selected.provider,
  }),
)
