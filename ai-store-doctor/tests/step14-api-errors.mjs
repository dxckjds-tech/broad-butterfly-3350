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

function loadClient(fetchImpl) {
  const stored = {
    provider: 'deepseek',
    deepseekApiKey: 'bad-key',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-v4-flash',
    deepseekThinking: 'disabled',
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
    'shared/storage-keys.js',
    'shared/pii-patterns.js',
    'shared/sanitize.js',
    'shared/result-schema.js',
    'shared/task-types.js',
    'shared/task-validators.js',
    'background/settings.js',
    'background/payload-builder.js',
    'background/ai-client.js',
    'background/message-handler.js',
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  return sandbox
}

const unauthorized = loadClient(async function () {
  return {
    ok: false,
    status: 401,
    json: async function () {
      return { error: { message: 'invalid api key' } }
    },
  }
})
let unauthorizedMsg = ''
try {
  await unauthorized.ASD.bg.aiClient.callAI([{ role: 'user', content: '{"ping":true}' }])
} catch (error) {
  unauthorizedMsg = error.message || String(error)
}
assert(/invalid api key|HTTP 401/i.test(unauthorizedMsg), '401 message: ' + unauthorizedMsg)
assert(
  unauthorized.ASD.bg.messageHandler.classify({ message: unauthorizedMsg, code: 'AUTH_ERROR' }) === 'AUTH_ERROR',
  '401 classify: ' + unauthorized.ASD.bg.messageHandler.classify({ message: unauthorizedMsg }),
)

const timeout = loadClient(function (url, opts) {
  return new Promise(function (resolve, reject) {
    if (opts && opts.signal) {
      opts.signal.addEventListener('abort', function () {
        const err = new Error('aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }
  })
})
let timeoutMsg = ''
try {
  await timeout.ASD.bg.aiClient.callAI([{ role: 'user', content: '{"ping":true}' }])
} catch (error) {
  timeoutMsg = error.message || String(error)
}
assert(/超时|未返回有效/.test(timeoutMsg), 'timeout message: ' + timeoutMsg)

const badJson = loadClient(async function () {
  return {
    ok: true,
    json: async function () {
      return { choices: [{ message: { content: 'NOT_JSON <<<' }, finish_reason: 'stop' }] }
    },
  }
})
let badJsonMsg = ''
try {
  await badJson.ASD.bg.aiClient.callAI([{ role: 'user', content: '{"ping":true}' }])
} catch (error) {
  badJsonMsg = error.message || String(error)
}
assert(/不是有效 JSON|未返回有效/.test(badJsonMsg), 'bad json message: ' + badJsonMsg)

const network = loadClient(async function () {
  throw new Error('Failed to fetch')
})
let networkMsg = ''
try {
  await network.ASD.bg.aiClient.callAI([{ role: 'user', content: '{"ping":true}' }])
} catch (error) {
  networkMsg = error.message || String(error)
}
assert(/Failed to fetch/.test(networkMsg), 'network message: ' + networkMsg)

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, unauthorized: unauthorizedMsg, timeout: timeoutMsg, badJson: badJsonMsg, network: networkMsg }))
