#!/usr/bin/env node
/**
 * Step 15.1 — unknown models stay fail-closed; response_format and vision
 * follow capabilities; task validator missing must not fetch.
 */
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
const registry = capsBox.ASD.providerRegistry

function expectSafeUnknown(provider, model, label) {
  const resolved = caps.resolve(provider, model)
  assert(resolved.text === true, label + ' text')
  assert(resolved.vision === false, label + ' vision: ' + resolved.vision)
  assert(resolved.reasoning === false, label + ' reasoning: ' + resolved.reasoning)
  assert(resolved.longContext === false, label + ' longContext')
  assert(resolved.structuredOutput === false, label + ' structuredOutput must not inherit API style')
}

expectSafeUnknown('qwen', 'qwen-future-unknown', 'qwen unknown')
expectSafeUnknown('moonshot', 'kimi-future-unknown', 'moonshot unknown')
expectSafeUnknown('openai', 'gpt-future-unknown', 'openai unknown')
assert(registry.get('openai').platformCapabilities.mayOfferVision === true, 'openai platform may offer vision')
assert(registry.get('openai').capabilities == null, 'openai provider must not declare model capabilities')

const over = caps.resolve('qwen', 'qwen-future-unknown', { vision: true })
assert(over.vision === true && over.reasoning === false, 'user Vision override wins without granting reasoning')

const heuristicVl = caps.resolve('custom', 'acme-vl-preview')
assert(heuristicVl.vision === true, 'heuristic may mark explicit vl token')
const trustedBeatsHeuristic = caps.resolve('custom', 'acme-vl-preview', null, { vision: false })
assert(trustedBeatsHeuristic.vision === false, 'trusted metadata beats heuristic')
const knownBeatsTrusted = caps.resolve('deepseek', 'deepseek-v4-flash', null, { vision: true })
assert(knownBeatsTrusted.vision === false, 'KNOWN table beats trusted metadata')
const userBeatsKnown = caps.resolve('deepseek', 'deepseek-v4-flash', { vision: true })
assert(userBeatsKnown.vision === true, 'user override beats KNOWN')

const routedBox = runFiles({ ASD: {}, console: console }, [
  'shared/provider-registry.js',
  'shared/provider-configs.js',
  'shared/model-capabilities.js',
  'background/provider-manager.js',
])
const openaiUnknownRouted = routedBox.ASD.bg.providerManager.resolveProvider(
  {
    providerConfigs: {
      configs: { openai: { apiKey: 'sk', model: 'gpt-future-unknown', enabled: true } },
    },
  },
  'openai',
)
assert(openaiUnknownRouted.capabilities.vision === false, 'resolveProvider openai unknown vision')
assert(openaiUnknownRouted.capabilities.reasoning === false, 'resolveProvider openai unknown reasoning')
assert(openaiUnknownRouted.meta.platformCapabilities.mayOfferVision === true, 'platform metadata remains available')

const adapterBox = runFiles({ ASD: {}, console: console, fetch: async function () {} }, ['background/providers/openai-compatible.js'])
const adapter = adapterBox.ASD.bg.providers.openaiCompatible
const imageMessages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'describe' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ],
  },
]

const customA = adapter.buildRequest({
  model: 'custom-a',
  messages: [{ role: 'user', content: 'ping' }],
  maxTokens: 32,
  responseFormat: { type: 'json_object' },
  capabilities: { structuredOutput: false, vision: false },
})
assert(!Object.prototype.hasOwnProperty.call(customA, 'response_format'), 'Custom A must omit response_format')

const customB = adapter.buildRequest({
  model: 'custom-b',
  messages: [{ role: 'user', content: 'ping' }],
  maxTokens: 32,
  responseFormat: { type: 'json_object' },
  capabilities: { structuredOutput: true, vision: false },
})
assert(customB.response_format && customB.response_format.type === 'json_object', 'Custom B may send JSON mode')

const customC = adapter.buildRequest({
  model: 'custom-c',
  messages: imageMessages,
  maxTokens: 32,
  capabilities: { structuredOutput: false, vision: false },
})
assert(JSON.stringify(customC).indexOf('image_url') === -1, 'Custom C adapter request must drop images')
assert(typeof customC.messages[0].content === 'string' && customC.messages[0].content.indexOf('describe') !== -1, 'Custom C keeps text')

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

function loadRouter() {
  return runFiles({ ASD: {}, console: console, Date: Date, Math: Math }, [
    'shared/constants.js',
    'shared/provider-registry.js',
    'shared/provider-configs.js',
    'shared/model-capabilities.js',
    'shared/task-profiles.js',
    'background/provider-manager.js',
    'background/model-health.js',
    'background/model-router.js',
  ])
}

const pickBox = loadRouter()
const pickVision = pickBox.ASD.bg.modelRouter.selectModel(
  'product_diagnosis',
  {
    hasImages: true,
    settings: settings({
      qwen: { model: 'qwen-future-unknown', apiKey: 'qk' },
      moonshot: { model: 'kimi-k2.5', apiKey: 'mk' },
    }),
  },
  { mode: 'auto' },
)
assert(pickVision.ok && pickVision.selected.provider === 'moonshot', 'unknown text + known vision must pick vision model')
assert(pickVision.selected.capabilities.vision === true, 'selected capabilities keep vision')

const unknownOnly = loadRouter()
const unknownPick = unknownOnly.ASD.bg.modelRouter.selectModel(
  'product_diagnosis',
  {
    hasImages: true,
    settings: settings({
      qwen: { model: 'qwen-future-unknown', apiKey: 'qk' },
      moonshot: { model: 'kimi-future-unknown', apiKey: 'mk' },
      openai: { model: 'gpt-future-unknown', apiKey: 'ok' },
    }),
  },
  { mode: 'auto' },
)
assert(unknownPick.ok, 'AUTO may text-fallback when every model is unknown')
assert(unknownPick.selected.capabilities.vision === false, 'unknown-only selection stays non-vision')
assert(
  (unknownPick.reason || []).indexOf('未配置已确认支持视觉的模型，改为纯文本诊断') !== -1,
  'unknown-only debug reason: ' + (unknownPick.reason || []).join(','),
)

function loadClient(fetchImpl, opts) {
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
  const files = []
  if (opts && opts.withValidators) {
    files.push('shared/result-schema.js', 'shared/task-types.js', 'shared/task-validators.js')
  }
  if (opts && opts.withRouter) {
    files.push(
      'shared/constants.js',
      'shared/provider-registry.js',
      'shared/provider-configs.js',
      'shared/model-capabilities.js',
      'shared/task-profiles.js',
      'background/providers/openai-compatible.js',
      'background/provider-manager.js',
      'background/model-health.js',
      'background/model-router.js',
    )
  } else {
    files.push('background/providers/openai-compatible.js')
  }
  files.push('background/ai-client.js')
  runFiles(sandbox, files)
  if (opts && opts.withSanitize) {
    sandbox.ASD.sanitize = {
      sanitizePayload: function (messages) {
        return messages
      },
    }
  }
  sandbox.ASD.bg.settings = {
    load: async function () {
      return (opts && opts.settings) || {
        provider: 'custom',
        providerConfigs: {
          activeMode: 'fixed',
          configs: {
            custom: {
              enabled: true,
              apiKey: 'ck',
              baseUrl: 'https://custom.example/v1',
              model: 'custom-model',
              capabilitiesOverride: (opts && opts.override) || null,
            },
          },
        },
      }
    },
  }
  return sandbox
}

const bodies = []
const customClient = loadClient(
  async function (url, init) {
    bodies.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async function () {
        return { choices: [{ message: { content: '{"ok":true,"message":"连接成功"}' }, finish_reason: 'stop' }] }
      },
    }
  },
  {
    withValidators: true,
    withSanitize: true,
    withRouter: true,
    override: { structuredOutput: false, vision: false },
  },
)

await customClient.ASD.bg.aiClient.callAI({
  task: 'connection_test',
  provider: 'custom',
  messages: [{ role: 'user', content: '连通性测试' }],
  maxTokens: 64,
})
assert(bodies.length >= 1, 'Custom A/B client fetched')
assert(!Object.prototype.hasOwnProperty.call(bodies[0], 'response_format'), 'Custom A callAI omits response_format')

bodies.length = 0
const customBClient = loadClient(
  async function (url, init) {
    bodies.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async function () {
        return { choices: [{ message: { content: '{"ok":true,"message":"连接成功"}' }, finish_reason: 'stop' }] }
      },
    }
  },
  {
    withValidators: true,
    withSanitize: true,
    withRouter: true,
    override: { structuredOutput: true, vision: false },
  },
)
await customBClient.ASD.bg.aiClient.callAI({
  task: 'connection_test',
  provider: 'custom',
  messages: [{ role: 'user', content: '连通性测试' }],
  maxTokens: 64,
})
assert(bodies[0] && bodies[0].response_format && bodies[0].response_format.type === 'json_object', 'Custom B callAI sends JSON mode')

bodies.length = 0
const customCClient = loadClient(
  async function (url, init) {
    bodies.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async function () {
        return { choices: [{ message: { content: '{"translation":"球阀"}' }, finish_reason: 'stop' }] }
      },
    }
  },
  {
    withValidators: true,
    withSanitize: true,
    withRouter: true,
    override: { structuredOutput: false, vision: false },
  },
)
await customCClient.ASD.bg.aiClient.callAI({
  task: 'translation',
  provider: 'custom',
  messages: imageMessages,
  maxTokens: 64,
})
assert(JSON.stringify(bodies[0]).indexOf('image_url') === -1, 'Custom C callAI must not send image_url')

let visionCode = ''
const mustVision = loadClient(
  async function () {
    throw new Error('vision_analysis must not fetch')
  },
  {
    withValidators: true,
    withSanitize: true,
    withRouter: true,
    override: { vision: false, structuredOutput: false },
  },
)
try {
  await mustVision.ASD.bg.aiClient.callAI({
    task: 'vision_analysis',
    provider: 'custom',
    messages: imageMessages,
    maxTokens: 64,
  })
} catch (error) {
  visionCode = error.code || error.message
}
assert(visionCode === 'UNSUPPORTED_CAPABILITY', 'required vision task fail-closed: ' + visionCode)

const missingValidator = loadClient(async function () {
  throw new Error('validator-missing must not fetch')
}, { withSanitize: true, withRouter: false })
let validatorCode = ''
let validatorFetched = false
missingValidator.fetch = async function () {
  validatorFetched = true
  return { ok: true, json: async function () { return {} } }
}
try {
  await missingValidator.ASD.bg.aiClient.callAI({
    task: 'connection_test',
    provider: 'custom',
    messages: [{ role: 'user', content: 'ping' }],
  })
} catch (error) {
  validatorCode = error.code || error.message
}
assert(validatorCode === 'TASK_VALIDATOR_UNAVAILABLE', 'missing validator code: ' + validatorCode)
assert(validatorFetched === false, 'missing validator must not fetch')

let capturedCaps = null
const routeClient = loadClient(
  async function (url, init) {
    return {
      ok: true,
      json: async function () {
        return { choices: [{ message: { content: '{"translation":"阀"}' }, finish_reason: 'stop' }] }
      },
    }
  },
  {
    withValidators: true,
    withSanitize: true,
    withRouter: true,
    settings: settings({
      openai: { model: 'gpt-4o-mini', apiKey: 'ok' },
      moonshot: { apiKey: '' },
      qwen: { apiKey: '' },
      deepseek: { apiKey: '' },
    }),
  },
)
const origSend = routeClient.ASD.bg.providers.openaiCompatible.sendRequest
routeClient.ASD.bg.providers.openaiCompatible.sendRequest = async function (opts) {
  capturedCaps = opts.capabilities
  return origSend(opts)
}
const routedOut = await routeClient.ASD.bg.aiClient.callAI({
  task: 'translation',
  messages: [{ role: 'user', content: 'valve' }],
  maxTokens: 64,
})
assert(routedOut.route && routedOut.route.selected && routedOut.route.selected.capabilities, 'selectModel capabilities survive')
assert(capturedCaps && capturedCaps.vision === true, 'executeOnRouted received selected.capabilities.vision')
assert(capturedCaps.structuredOutput === true, 'executeOnRouted received selected.capabilities.structuredOutput')

const schemaBox = runFiles({ ASD: {}, console: console }, [
  'shared/result-schema.js',
  'shared/task-types.js',
  'shared/task-validators.js',
])
const diag = schemaBox.ASD.taskValidators.validateByTask('product_diagnosis', { ok: true, message: '连接成功' })
assert(!diag.ok && (diag.errors || []).indexOf('MISSING_SUMMARY') !== -1, 'product diagnosis keeps result schema')
const diagOk = schemaBox.ASD.taskValidators.validateByTask('product_diagnosis', {
  summary: { identity: 'Ball Valve', confidence: 80, status: 'VERIFIED' },
  facts: [],
  keywords: {},
  content: {},
})
assert(diagOk.ok, 'product diagnosis still accepts valid schema')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    unknownSafe: true,
    overrideWins: true,
    customA: 'no-response_format',
    customB: 'json_object',
    customC: 'images-stripped',
    visionGuard: visionCode,
    validatorFailClosed: validatorCode,
    routerUnknownPicksVision: pickVision.selected.provider,
    unknownOnlyReason: true,
    selectedCapsReachedExecute: true,
    diagnosisSchemaStrict: true,
  }),
)
