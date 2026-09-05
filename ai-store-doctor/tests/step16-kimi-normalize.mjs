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

function loadAdapter() {
  const sandbox = { ASD: {}, console: console, fetch: async function () {}, AbortController: AbortController }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(root, 'shared/response-normalize.js'), 'utf8'), ctx)
  vm.runInContext(fs.readFileSync(path.join(root, 'background/providers/openai-compatible.js'), 'utf8'), ctx)
  return sandbox.ASD.bg.providers.openaiCompatible
}

function loadClient(fetchImpl) {
  const stored = {
    provider: 'kimi',
    kimiApiKey: 'sk-kimi-test',
    kimiBaseUrl: 'https://api.moonshot.cn/v1',
    kimiModel: 'kimi-k2.5',
  }
  const sandbox = {
    ASD: {},
    console: console,
    fetch: fetchImpl,
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms >= 1000 ? 5 : ms)
    },
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    AbortController: AbortController,
    chrome: {
      storage: {
        local: {
          get: async function () {
            return Object.assign({}, stored)
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
    'shared/response-normalize.js',
    'shared/capability-learning.js',
    'shared/storage-keys.js',
    'shared/pii-patterns.js',
    'shared/sanitize.js',
    'shared/result-schema.js',
    'shared/task-types.js',
    'shared/task-validators.js',
    'background/settings.js',
    'background/providers/openai-compatible.js',
    'shared/payload-compactor.js',
    'background/payload-builder.js',
    'background/ai-client.js',
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  return sandbox
}

const adapter = loadAdapter()
const stringNorm = adapter.normalizeResponse(
  {
    id: 'cmpl',
    model: 'kimi-k2.5',
    choices: [{ message: { role: 'assistant', content: '{"ok":true,"message":"连接成功"}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3, completion_tokens: 4 },
  },
  { httpStatus: 200, provider: 'Kimi', model: 'kimi-k2.5' },
)
assert(stringNorm.content.indexOf('"ok":true') !== -1, 'string content')
assert(stringNorm.debug.contentType === 'string', 'string contentType')
assert(stringNorm.debug.provider === 'Kimi', 'debug provider')
assert(stringNorm.debug.model === 'kimi-k2.5', 'debug model')
assert(stringNorm.debug.httpStatus === 200, 'debug httpStatus')
assert(stringNorm.debug.finishReason === 'stop', 'debug finishReason')
assert(stringNorm.debug.choicesCount === 1, 'debug choicesCount')
assert(stringNorm.debug.contentLength > 0, 'debug contentLength')
assert(stringNorm.debug.hasReasoningContent === false, 'string hasReasoningContent')
assert(stringNorm.debug.topLevelKeys.indexOf('choices') !== -1, 'topLevelKeys')
assert(stringNorm.debug.messageKeys.indexOf('content') !== -1, 'messageKeys')
assert(!stringNorm.raw, 'must not keep full raw response')
assert(JSON.stringify(stringNorm.debug).indexOf('sk-') === -1, 'debug must not include api key')
assert(JSON.stringify(stringNorm.debug).indexOf('Bearer') === -1, 'debug must not include Authorization')

const arrayNorm = adapter.normalizeResponse({
  model: 'kimi-k2.5',
  choices: [
    {
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: '{"translation":' },
          { type: 'text', text: '"阀门"}' },
        ],
      },
      finish_reason: 'stop',
    },
  ],
})
assert(arrayNorm.content === '{"translation":"阀门"}', 'array content joined: ' + arrayNorm.content)
assert(arrayNorm.debug.contentType === 'array', 'array contentType')

const emptyStop = adapter.normalizeResponse({
  choices: [{ message: { role: 'assistant', content: '', reasoning_content: '{"ok":true}' }, finish_reason: 'stop' }],
})
assert(emptyStop.contentSource === 'REASONING_RECOVERY', 'empty stop recovery source: ' + emptyStop.contentSource)
assert(emptyStop.reasoningContent.indexOf('ok') !== -1, 'reasoning preserved separately')
assert(emptyStop.debug.hasReasoningContent === true, 'hasReasoningContent')
assert(emptyStop.finishReason === 'stop', 'empty stop finishReason')

const lengthNorm = adapter.normalizeResponse({
  choices: [{ message: { content: '{"ok":true' }, finish_reason: 'length' }],
})
assert(lengthNorm.finishReason === 'length', 'length finishReason')

function leak(obj) {
  const text = JSON.stringify(obj)
  return ['sk-kimi-test', 'Authorization', 'Bearer', '完整商品', 'prompt'].filter(function (item) {
    return text.indexOf(item) !== -1
  })
}

const stringClient = loadClient(async function () {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return { choices: [{ message: { content: '{"ok":true,"message":"连接成功"}' }, finish_reason: 'stop' }], model: 'kimi-k2.5' }
    },
  }
})
const conn = await stringClient.ASD.bg.aiClient.callAI({
  task: 'connection_test',
  provider: 'kimi',
  messages: [
    { role: 'system', content: 'test' },
    { role: 'user', content: '{"ping":true}' },
  ],
})
assert(conn.result && conn.result.ok === true, 'connection_test string')
assert(conn.responseDebug && conn.responseDebug.contentType === 'string', 'connection_test debug')
assert(leak(conn.responseDebug).length === 0, 'connection debug leak: ' + leak(conn.responseDebug))

const arrayClient = loadClient(async function () {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return {
        choices: [{ message: { content: [{ type: 'text', text: '{"translation":"球阀"}' }] }, finish_reason: 'stop' }],
      }
    },
  }
})
const translated = await arrayClient.ASD.bg.aiClient.callAI({
  task: 'translation',
  provider: 'moonshot',
  messages: [{ role: 'user', content: 'ball valve' }],
})
assert(translated.result && translated.result.translation === '球阀', 'translation array content')
assert(translated.responseDebug.contentType === 'array', 'translation contentType')

const stopClient = loadClient(async function () {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return { choices: [{ message: { content: '' }, finish_reason: 'stop' }] }
    },
  }
})
let stopErr = null
try {
  await stopClient.ASD.bg.aiClient.callAI({
    task: 'connection_test',
    provider: 'kimi',
    messages: [{ role: 'user', content: 'x' }],
  })
} catch (error) {
  stopErr = error
}
assert(stopErr && (stopErr.code === 'RESPONSE_ERROR' || stopErr.code === 'EMPTY_FINAL_CONTENT'), 'stop+empty code: ' + (stopErr && stopErr.code))
assert(stopErr && stopErr.responseDebug, 'stop+empty metadata')
assert(stopErr.responseDebug.finishReason === 'stop', 'stop+empty finishReason')
assert(leak(stopErr.responseDebug).length === 0, 'stop debug leak')

const lengthClient = loadClient(async function () {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return { choices: [{ message: { content: '' }, finish_reason: 'length' }] }
    },
  }
})
let lengthErr = null
try {
  await lengthClient.ASD.bg.aiClient.callAI({
    task: 'connection_test',
    provider: 'kimi',
    messages: [{ role: 'user', content: 'x' }],
  })
} catch (error) {
  lengthErr = error
}
assert(lengthErr && (lengthErr.code === 'LENGTH_ERROR' || lengthErr.code === 'OUTPUT_TRUNCATED'), 'length code: ' + (lengthErr && lengthErr.code))

const reasoningClient = loadClient(async function () {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return {
        choices: [
          {
            message: { content: '', reasoning_content: '{"ok":true,"message":"不该采用思考内容"}' },
            finish_reason: 'stop',
          },
        ],
      }
    },
  }
})
const reasoningClientResult = await reasoningClient.ASD.bg.aiClient.callAI({
  task: 'connection_test',
  provider: 'kimi',
  messages: [{ role: 'user', content: 'x' }],
})
assert(reasoningClientResult && reasoningClientResult.connection && reasoningClientResult.connection.liveness === 'ok', 'reasoning liveness')
assert(reasoningClientResult.contentSource === 'REASONING_RECOVERY', 'reasoning contentSource')
assert(reasoningClientResult.result && reasoningClientResult.result.structured === 'ok', 'reasoning structured from recovered json')

const src = fs.readFileSync(path.join(root, 'background/ai-client.js'), 'utf8')
assert(!/tryParseJson\(reasoning\)/.test(src), 'ai-client must not parse reasoning_content as final JSON')
assert(/ASD\.responseNormalize/.test(src), 'ai-client fallback fetch must reuse shared normalize')
assert(fs.readFileSync(path.join(root, 'shared/response-normalize.js'), 'utf8').includes('function normalizeResponse'), 'single shared normalize')
assert(!/function normalizeResponse/.test(fs.readFileSync(path.join(root, 'background/ai-client.js'), 'utf8')), 'ai-client must not define normalizeResponse')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    string: stringNorm.debug.contentType,
    array: arrayNorm.debug.contentType,
    stopEmpty: stopErr && stopErr.code,
    length: lengthErr && lengthErr.code,
    reasoningOnly: reasoningClientResult && reasoningClientResult.contentSource,
  }),
)
