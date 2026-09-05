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

function load(fetchImpl) {
  const sandbox = {
    ASD: {},
    console: console,
    fetch: fetchImpl,
    AbortController: AbortController,
  }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(root, 'background/providers/openai-compatible.js'), 'utf8'), ctx)
  return sandbox.ASD.bg.providers.openaiCompatible
}

const connect = load(async function (url, opts) {
  assert(/\/chat\/completions$/.test(url), 'connect url: ' + url)
  const body = JSON.parse(opts.body)
  assert(body.messages[0].content.indexOf('连通') !== -1 || body.max_tokens === 512, 'connect body')
  return {
    ok: true,
    json: async function () {
      return { choices: [{ message: { content: '{"ok":true,"message":"连接成功"}' }, finish_reason: 'stop' }], model: 'demo' }
    },
  }
})
const conn = await connect.testConnection({
  apiKey: 'k',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  messages: [{ role: 'user', content: '连通性测试' }],
  maxTokens: 512,
})
assert(conn.content.indexOf('"ok":true') !== -1, 'connection_test content')
assert(conn.finishReason === 'stop', 'connection_test finish_reason')

const text = load(async function (url, opts) {
  const body = JSON.parse(opts.body)
  assert(body.model === 'gpt-4o-mini', 'text model')
  assert(opts.headers.Authorization === 'Bearer sk-test', 'bearer token')
  return {
    ok: true,
    json: async function () {
      return { choices: [{ message: { content: '{"translation":"阀门"}' }, finish_reason: 'stop' }], usage: { total_tokens: 9 } }
    },
  }
})
const textOut = await text.sendRequest({
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'hello' }],
  maxTokens: 200,
})
assert(textOut.content.indexOf('阀门') !== -1, 'text request')
assert(textOut.usage.total_tokens === 9, 'usage')

const auth = load(async function () {
  return {
    ok: false,
    status: 401,
    json: async function () {
      return { error: { message: 'invalid api key' } }
    },
  }
})
let authCode = ''
try {
  await auth.sendRequest({
    apiKey: 'bad',
    baseUrl: 'https://api.deepseek.com',
    model: 'x',
    messages: [{ role: 'user', content: 'x' }],
    maxTokens: 16,
  })
} catch (error) {
  authCode = error.code
}
assert(authCode === 'AUTH_ERROR', 'auth error code: ' + authCode)

const listed = load(async function (url) {
  assert(/\/models$/.test(url), 'list url')
  return {
    ok: true,
    json: async function () {
      return { data: [{ id: 'b' }, { id: 'a' }] }
    },
  }
})
const models = await listed.listModels({ apiKey: 'k', baseUrl: 'https://api.openai.com/v1' })
assert(models.models.join(',') === 'a,b', 'model_list sorted: ' + models.models.join(','))

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, connection: true, text: true, auth: authCode, models: models.models }))
