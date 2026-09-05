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

function mockChrome() {
  const mem = {}
  return {
    mem: mem,
    storage: {
      local: {
        get: async function (keys) {
          if (keys == null) throw new Error('get(null) forbidden')
          if (typeof keys === 'string') {
            const out = {}
            out[keys] = mem[keys]
            return out
          }
          if (Array.isArray(keys)) {
            const out = {}
            keys.forEach(function (key) {
              out[key] = mem[key]
            })
            return out
          }
          throw new Error('unexpected get shape')
        },
        set: async function (obj) {
          Object.keys(obj).forEach(function (key) {
            mem[key] = obj[key]
          })
        },
        remove: async function (keys) {
          ;(Array.isArray(keys) ? keys : [keys]).forEach(function (key) {
            delete mem[key]
          })
        },
      },
    },
  }
}

const chrome = mockChrome()
const sandbox = { ASD: {}, console, chrome: chrome, Date: Date, Math: Math }
sandbox.globalThis = sandbox
const ctx = vm.createContext(sandbox)
for (const file of [
  'shared/constants.js',
  'shared/storage-keys.js',
  'shared/pii-patterns.js',
  'shared/sanitize.js',
  'shared/health-score.js',
  'sidepanel/history-store.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
}
const store = sandbox.ASD.sidepanel.historyStore

assert(!/get\(\s*null\s*\)/.test(fs.readFileSync(path.join(root, 'sidepanel/history-store.js'), 'utf8')), 'history get(null)')
assert(!/get\(\s*null\s*\)/.test(fs.readFileSync(path.join(root, 'background/settings.js'), 'utf8')), 'settings get(null)')
assert(!/get\(\s*null\s*\)/.test(fs.readFileSync(path.join(root, 'background/ai-client.js'), 'utf8')), 'ai-client get(null)')

const first = await store.put({
  productName: 'Valve A',
  productIdentity: 'DN50 Ball Valve',
  url: 'https://sample.made-in-china.com/a',
  healthScore: 72,
  model: 'deepseek-chat',
  provider: 'DeepSeek',
  report: { summary: { identity: 'DN50 Ball Valve', confidence: 80 }, facts: [], keywords: {}, content: {} },
  product: {
    product: { name: 'Valve A', sku: 'SKU1' },
    current: { title: 'Valve A', keywords: ['valve'], description: 'desc' },
    fallbackText: 'SHOULD_NOT_SAVE',
    images: [{ src: 'data:image/png;base64,AAAA' }],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
})
assert(first.id, 'put id')
const got = await store.get(first.id)
assert(got && got.productName === 'Valve A', 'get record')
assert(got.promptVersion && got.schemaVersion && got.scoreVersion && got.extensionVersion, 'version fields')
assert(!JSON.stringify(got).includes('SHOULD_NOT_SAVE'), 'fallbackText saved')
assert(!JSON.stringify(got).includes('data:image'), 'base64 image saved')
const listed = await store.list()
assert(listed.length === 1 && listed[0].healthScore === 72, 'list one')

await store.remove(first.id)
assert((await store.list()).length === 0, 'deleted from index')
assert((await store.get(first.id)) == null, 'deleted item')

for (let i = 0; i < 100; i += 1) {
  await store.put({
    productName: 'Item ' + i,
    productIdentity: 'ID ' + i,
    url: 'https://sample.made-in-china.com/' + i,
    healthScore: 50,
    createdAt: '2026-02-01T00:00:00.' + String(i).padStart(3, '0') + 'Z',
    report: { summary: { identity: 'ID ' + i } },
    product: { product: { name: 'Item ' + i }, current: { title: 'Item ' + i, keywords: [], description: '' } },
  })
}
assert((await store.list()).length === 100, '100 records')
const beforeBytes = Buffer.byteLength(JSON.stringify(chrome.mem), 'utf8')
assert(beforeBytes < 1.5 * 1024 * 1024, '100 records exceed 1.5MB: ' + beforeBytes)

const extra = await store.put({
  productName: 'Item 100',
  productIdentity: 'ID 100',
  url: 'https://sample.made-in-china.com/100',
  healthScore: 51,
  createdAt: '2026-03-01T00:00:00.000Z',
  report: { summary: { identity: 'ID 100' } },
  product: { product: { name: 'Item 100' }, current: { title: 'T', keywords: [], description: '' } },
})
const after = await store.list()
assert(after.length === 100, '101st must prune to 100, got ' + after.length)
assert(
  !after.some(function (row) {
    return row.productName === 'Item 0'
  }),
  'oldest Item 0 must be evicted',
)
assert(
  after.some(function (row) {
    return row.id === extra.id
  }),
  'newest kept',
)
assert((await store.get(after[0].id)) != null, 'remaining item readable')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, bytes: beforeBytes }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, bytes100: beforeBytes, evicted: 'Item 0', kept: extra.productName }))
