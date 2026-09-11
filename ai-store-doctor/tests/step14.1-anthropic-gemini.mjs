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

function load(file, fetchImpl) {
  const sandbox = { ASD: {}, console: console, fetch: fetchImpl }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
  return sandbox.ASD.bg.providers
}

const anthropic = load(
  'background/providers/anthropic.js',
  async function (url, opts) {
    if (/\/v1\/models$/.test(url)) {
      assert(opts.headers['x-api-key'] === 'ak', 'anthropic list key')
      return { ok: true, json: async function () { return { data: [{ id: 'claude-sonnet-4-20250514' }] } } }
    }
    assert(/\/v1\/messages$/.test(url), 'anthropic url ' + url)
    const body = JSON.parse(opts.body)
    assert(body.system.indexOf('连通') !== -1, 'anthropic system')
    assert(body.messages[0].role === 'user', 'anthropic user')
    if (opts._forceError) return { ok: false, status: 401, json: async function () { return { error: { message: 'invalid api key' } } } }
    return {
      ok: true,
      json: async function () {
        return { content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', model: 'claude-sonnet-4-20250514' }
      },
    }
  },
).anthropic

const aConn = await anthropic.testConnection({
  apiKey: 'ak',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
  messages: [
    { role: 'system', content: '你正在执行 API 连通性测试。只输出 JSON，不要解释。' },
    { role: 'user', content: '{"ok":true}' },
  ],
})
assert(aConn.content.indexOf('"ok":true') !== -1, 'anthropic connection')
assert(aConn.finishReason === 'stop', 'anthropic stop')

const aText = await anthropic.sendRequest({
  apiKey: 'ak',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
  messages: [
    { role: 'system', content: '连通' },
    { role: 'user', content: 'hello' },
  ],
  maxTokens: 64,
})
assert(aText.content.indexOf('ok') !== -1, 'anthropic text')

const aList = await anthropic.listModels({ apiKey: 'ak', baseUrl: 'https://api.anthropic.com' })
assert(aList.models[0] === 'claude-sonnet-4-20250514', 'anthropic model_list')

const anthropicErr = load('background/providers/anthropic.js', async function () {
  return { ok: false, status: 401, json: async function () { return { error: { message: 'invalid api key' } } } }
}).anthropic
let aCode = ''
try {
  await anthropicErr.sendRequest({
    apiKey: 'bad',
    baseUrl: 'https://api.anthropic.com',
    model: 'x',
    messages: [{ role: 'user', content: 'x' }],
  })
} catch (error) {
  aCode = error.code
}
assert(aCode === 'AUTH_ERROR', 'anthropic auth: ' + aCode)

const gemini = load(
  'background/providers/gemini.js',
  async function (url, opts) {
    if (/\/v1beta\/models\?/.test(url) && !/:generateContent/.test(url)) {
      return { ok: true, json: async function () { return { models: [{ name: 'models/gemini-2.0-flash' }] } } }
    }
    assert(/generateContent/.test(url), 'gemini url ' + url)
    assert(/key=gk/.test(url), 'gemini key query')
    const body = JSON.parse(opts.body)
    assert(body.contents[0].role === 'user', 'gemini user role')
    return {
      ok: true,
      json: async function () {
        return { candidates: [{ content: { parts: [{ text: '{"translation":"阀"}' }] }, finishReason: 'STOP' }] }
      },
    }
  },
).gemini

const gConn = await gemini.testConnection({
  apiKey: 'gk',
  baseUrl: 'https://generativelanguage.googleapis.com',
  model: 'gemini-2.0-flash',
  messages: [
    { role: 'system', content: '连通性测试' },
    { role: 'user', content: '{"ok":true}' },
  ],
})
assert(gConn.content.indexOf('translation') !== -1, 'gemini connection/text')
assert(gConn.finishReason === 'stop', 'gemini stop')

const gList = await gemini.listModels({ apiKey: 'gk', baseUrl: 'https://generativelanguage.googleapis.com' })
assert(gList.models[0] === 'gemini-2.0-flash', 'gemini model_list')

const geminiErr = load('background/providers/gemini.js', async function () {
  return { ok: false, status: 403, json: async function () { return { error: { message: 'API key not valid' } } } }
}).gemini
let gCode = ''
try {
  await geminiErr.sendRequest({
    apiKey: 'bad',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash',
    messages: [{ role: 'user', content: 'x' }],
  })
} catch (error) {
  gCode = error.code
}
assert(gCode === 'AUTH_ERROR', 'gemini auth: ' + gCode)

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, anthropic: { connection: true, auth: aCode, models: aList.models }, gemini: { text: true, auth: gCode, models: gList.models } }))
