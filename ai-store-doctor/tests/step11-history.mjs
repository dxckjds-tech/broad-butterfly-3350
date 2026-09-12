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
    current: { title: 'Valve A', keywords: ['valve'], description: 'contact alice@example.com' },
    fallbackText: 'SHOULD_NOT_SAVE',
    visibleText: 'VISIBLE_TEXT_MUST_NOT_SAVE',
    html: '<p>HTML_MUST_NOT_SAVE</p>',
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
assert(!JSON.stringify(got).includes('VISIBLE_TEXT_MUST_NOT_SAVE'), 'visibleText saved')
assert(!JSON.stringify(got).includes('HTML_MUST_NOT_SAVE'), 'html saved')
assert(!JSON.stringify(got).includes('alice@example.com'), 'PII email saved raw')
assert(JSON.stringify(got).includes('[REDACTED_EMAIL]'), 'PII email not redacted')
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

function loadStoreWithoutSanitize() {
  const chrome2 = mockChrome()
  const setKeys = []
  const origSet = chrome2.storage.local.set
  chrome2.storage.local.set = async function (obj) {
    Object.keys(obj).forEach(function (key) {
      setKeys.push(key)
    })
    return origSet(obj)
  }
  const sandbox2 = { ASD: {}, console: console, chrome: chrome2, Date: Date, Math: Math }
  sandbox2.globalThis = sandbox2
  const ctx2 = vm.createContext(sandbox2)
  ;['shared/constants.js', 'shared/storage-keys.js', 'shared/health-score.js', 'sidepanel/history-store.js'].forEach(
    function (file) {
      vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx2, { filename: file })
    },
  )
  return { store: sandbox2.ASD.sidepanel.historyStore, chrome: chrome2, setKeys: setKeys }
}

const closed = loadStoreWithoutSanitize()
let closedErr = ''
try {
  await closed.store.put({
    productName: 'No Sanitize',
    productIdentity: 'X',
    url: 'https://sample.made-in-china.com/nosanitize',
    healthScore: 10,
    report: { summary: { identity: 'X' }, facts: [], keywords: {}, content: {} },
    product: {
      product: { name: 'X' },
      current: { title: 'X', keywords: [], description: 'secret@example.com' },
    },
  })
} catch (error) {
  closedErr = error && error.message ? String(error.message) : String(error)
}
assert(closedErr === 'SECURITY_SANITIZER_UNAVAILABLE', 'sanitizer missing must throw, got ' + closedErr)
assert(
  !closed.setKeys.some(function (key) {
    return /^hist:/.test(key) && key !== 'hist:idx'
  }),
  'sanitizer missing must not write hist:<id>, set keys=' + closed.setKeys.join(','),
)
assert(
  !Object.keys(closed.chrome.mem).some(function (key) {
    return /^hist:/.test(key) && key !== 'hist:idx'
  }),
  'sanitizer missing must not persist hist:<id>',
)

const notFnChrome = mockChrome()
const notFnSetKeys = []
const notFnOrigSet = notFnChrome.storage.local.set
notFnChrome.storage.local.set = async function (obj) {
  Object.keys(obj).forEach(function (key) {
    notFnSetKeys.push(key)
  })
  return notFnOrigSet(obj)
}
const notFnSandbox = { ASD: { sanitize: { sanitizeCollected: true } }, console: console, chrome: notFnChrome, Date: Date, Math: Math }
notFnSandbox.globalThis = notFnSandbox
const notFnCtx = vm.createContext(notFnSandbox)
;['shared/constants.js', 'shared/storage-keys.js', 'shared/health-score.js', 'sidepanel/history-store.js'].forEach(
  function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), notFnCtx, { filename: file })
  },
)
let notFnErr = ''
try {
  await notFnSandbox.ASD.sidepanel.historyStore.put({
    productName: 'Not Fn',
    report: { summary: { identity: 'Y' } },
    product: { product: { name: 'Y' }, current: { title: 'Y', keywords: [], description: '' } },
  })
} catch (error) {
  notFnErr = error && error.message ? String(error.message) : String(error)
}
assert(notFnErr === 'SECURITY_SANITIZER_UNAVAILABLE', 'sanitizeCollected not function must throw, got ' + notFnErr)
assert(
  !notFnSetKeys.some(function (key) {
    return /^hist:/.test(key) && key !== 'hist:idx'
  }),
  'sanitizeCollected not function must not write hist:<id>',
)

const actionSandbox = { ASD: {}, console: console, chrome: mockChrome(), Date: Date, Math: Math }
actionSandbox.globalThis = actionSandbox
const actionCtx = vm.createContext(actionSandbox)
vm.runInContext(fs.readFileSync(path.join(root, 'sidepanel/state.js'), 'utf8'), actionCtx, { filename: 'state.js' })
vm.runInContext(fs.readFileSync(path.join(root, 'sidepanel/actions.js'), 'utf8'), actionCtx, { filename: 'actions.js' })
actionSandbox.ASD.sidepanel.historyStore = {
  put: async function () {
    throw new Error('SECURITY_SANITIZER_UNAVAILABLE')
  },
  list: async function () {
    return []
  },
}
let actionCrashed = false
actionSandbox.ASD.sidepanel.app = {
  render: function () {
    return true
  },
}
actionSandbox.ASD.sidepanel.state.update(
  {
    report: { summary: { identity: 'X', confidence: 1 } },
    fields: { url: 'https://sample.made-in-china.com/x' },
    product: { product: { name: 'X' } },
    health: { total: 1, dimensions: [], scoreVersion: '1' },
    meta: {},
  },
  'test',
)
let saved
try {
  saved = await actionSandbox.ASD.sidepanel.actions.saveHistory()
} catch (_error) {
  actionCrashed = true
}
assert(!actionCrashed, 'saveHistory must not throw when sanitizer missing')
assert(saved == null, 'saveHistory must return null on sanitizer fail')
assert(
  actionSandbox.ASD.sidepanel.state.get().saveNotice === '保存失败：安全过滤模块不可用，请重新加载扩展后重试。',
  'saveHistory notice: ' + actionSandbox.ASD.sidepanel.state.get().saveNotice,
)

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, bytes: beforeBytes }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    bytes100: beforeBytes,
    evicted: 'Item 0',
    kept: extra.productName,
    sanitizerMissing: closedErr,
    sanitizerMissingWrites: closed.setKeys,
  }),
)
