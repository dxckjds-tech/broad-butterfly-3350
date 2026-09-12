#!/usr/bin/env node
/**
 * Step 9 — concurrency, requestId / fieldsVersion discard, AI retry without re-read.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const registrySrc = fs.readFileSync(path.join(root, 'background/request-registry.js'), 'utf8')
assert(fs.existsSync(path.join(root, 'background/request-registry.js')), 'request-registry.js missing')
assert(/ns\.bg\.requests/.test(registrySrc) && /fingerprint/.test(registrySrc), 'registry API missing')

const sandbox = { ASD: {}, console }
vm.createContext(sandbox)
vm.runInContext(registrySrc, sandbox, { filename: 'request-registry.js' })
const requests = sandbox.ASD.bg.requests
assert(requests.nextId() !== requests.nextId(), 'nextId not unique')

let sharedHttp = 0
const shared = requests.run('same-key', async () => {
  sharedHttp += 1
  await new Promise((r) => setTimeout(r, 20))
  return { ok: true, http: sharedHttp }
})
const [a, b, c] = await Promise.all([
  requests.run('same-key', () => {
    throw new Error('must not run')
  }),
  shared,
  requests.run('same-key', () => {
    throw new Error('must not run')
  }),
])
assert(sharedHttp === 1 && a.ok && b.ok && c.ok, 'shared promise expected 1 HTTP, got ' + sharedHttp)

const mh = fs.readFileSync(path.join(root, 'background/message-handler.js'), 'utf8')
assert(/ASD\.bg\.requests\.run/.test(mh), 'ANALYZE must use request registry')
assert(/requestId: message\.requestId/.test(mh) && /fieldsVersion: message\.fieldsVersion/.test(mh), 'ANALYZE must echo requestId/fieldsVersion')
assert(/FIELD_ERROR/.test(mh) && /AI_ERROR/.test(mh) && /CONFIG_ERROR/.test(mh) && /SCHEMA_ERROR/.test(mh), 'error domains missing')
assert(/isSupportedHost/.test(mh), 'REQUEST_MIC_FIELDS L1 host check missing')

const actions = fs.readFileSync(path.join(root, 'sidepanel/actions.js'), 'utf8')
assert(/function guard\(/.test(actions), 'sidepanel guard() missing')
assert(/if \(!guard\(['"]analyze['"]\)\) return/.test(actions), 'analyze must call guard()')
assert(/aria-busy/.test(actions) && /disabled/.test(actions), 'setAnalyzeBusy must set disabled + aria-busy')
assert(/now\.requestId !== requestId/.test(actions), 'stale requestId discard missing')
assert(/now\.fieldsVersion !== fieldsVersion/.test(actions), 'stale fieldsVersion discard missing')
assert(/if \(!state\.fields\)/.test(actions), 'analyze only reads page when fields are missing')
assert(/REQUEST_URL_FIELDS/.test(actions), 'L3 pasted URL must use REQUEST_URL_FIELDS')
assert(/REQUEST_MIC_FIELDS/.test(actions), 'L1 current tab must use REQUEST_MIC_FIELDS')

const appSrc = fs.readFileSync(path.join(root, 'sidepanel/app.js'), 'utf8')
assert(/previewActiveUrl\(\)/.test(appSrc), 'boot must preview URL')
assert(!/DOMContentLoaded[\s\S]*actions\.read\(/.test(appSrc), 'boot must not auto-read')

const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8')
const { window } = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), {
  url: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sidepanel.html',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
})

let analyzeHttp = 0
let lastAnalyzeMsg = null
let analyzeResolve = null
let readCalls = 0
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])

window.chrome = {
  runtime: {
    lastError: null,
    getManifest() {
      return { version: '1.6.0' }
    },
    sendMessage(msg) {
      if (msg.type === 'GET_ACTIVE_URL') {
        return Promise.resolve({
          ok: true,
          url: 'https://www.made-in-china.com/product/demo.html',
        })
      }
      if (msg.type === 'GET_SETTINGS' || msg.type === 'OPEN_OPTIONS') {
        return Promise.resolve({ ok: true })
      }
      if (msg.type === 'REQUEST_MIC_FIELDS' || msg.type === 'REQUEST_URL_FIELDS' || msg.type === 'EXTRACT_MIC_FIELDS') {
        readCalls += 1
        return Promise.resolve({
          ok: true,
          fields: { productName: 'from-read', url: 'https://www.made-in-china.com/product/b.html' },
          product: { product: { name: 'from-read' } },
          url: 'https://www.made-in-china.com/product/b.html',
        })
      }
      if (msg.type === 'ANALYZE_PRODUCT') {
        analyzeHttp += 1
        lastAnalyzeMsg = msg
        return new Promise((resolve) => {
          analyzeResolve = resolve
        })
      }
      return Promise.resolve({ ok: false, reason: 'unexpected ' + msg.type })
    },
  },
  storage: {
    local: {
      async get(keys) {
        if (keys == null) throw new Error('get(null) forbidden')
        return {}
      },
      async set() {},
      async remove() {},
    },
    sync: {
      get(_k, cb) {
        if (cb) cb({})
      },
      set(_v, cb) {
        if (cb) cb()
      },
    },
  },
  tabs: {
    query(_q, cb) {
      if (cb) cb([{ id: 1, url: 'https://www.made-in-china.com/product/demo.html', title: 'Demo' }])
    },
  },
}

for (const rel of scripts) {
  window.eval(fs.readFileSync(path.join(root, rel), 'utf8'))
}

const state = window.ASD.sidepanel.state
state.update(
  {
    fields: { productName: 'MT-8800', keywords: ['inverter'], url: 'https://www.made-in-china.com/product/a.html' },
    product: { product: { name: 'MT-8800' }, debug: { newFieldCount: 2 } },
    fieldsVersion: 3,
    error: '',
    report: null,
    inflight: false,
  },
  'test:seed',
)
window.ASD.sidepanel.app.render()

const btn = window.document.querySelector('[data-action="analyze"]')
assert(!!btn, 'analyze button missing')
for (let i = 0; i < 10; i += 1) btn.click()
assert(analyzeHttp === 1, '10 analyze clicks must produce 1 HTTP, got ' + analyzeHttp)
assert(btn.disabled === true && btn.getAttribute('aria-busy') === 'true', 'button must be disabled + aria-busy during inflight')
assert(lastAnalyzeMsg && lastAnalyzeMsg.fieldsVersion === 3, 'analyze must carry fieldsVersion')
assert(lastAnalyzeMsg.type === 'ANALYZE_PRODUCT', 'analyze message type')

const currentId = lastAnalyzeMsg.requestId
const staleResolve = analyzeResolve
state.update({ requestId: 'stale-other' }, 'test:stale-id')
staleResolve({
  ok: true,
  requestId: currentId,
  fieldsVersion: 3,
  result: {
    summary: { oneLine: 'stale', identity: 'stale', confidence: 90, dataCompleteness: 80, contentReadiness: 70, topIssues: [] },
  },
})
await Promise.resolve()
await Promise.resolve()
assert(!state.get().report, 'stale requestId must not write report')

state.update(
  {
    inflight: false,
    requestId: '',
    report: null,
    fieldsVersion: 3,
    fields: { productName: 'MT-8800', url: 'https://www.made-in-china.com/product/a.html' },
    product: { product: { name: 'MT-8800' } },
  },
  'test:reset-version',
)
window.ASD.sidepanel.app.render()
window.ASD.sidepanel.setAnalyzeBusy && window.ASD.sidepanel.actions.setAnalyzeBusy(false)
btn.click()
assert(analyzeHttp === 2, 'second analyze after reset, http=' + analyzeHttp)
const versionId = lastAnalyzeMsg.requestId
const versionResolve = analyzeResolve
state.update({ fieldsVersion: 4 }, 'test:page-b')
versionResolve({
  ok: true,
  requestId: versionId,
  fieldsVersion: 3,
  result: {
    summary: { oneLine: 'old page', identity: 'old', confidence: 90, dataCompleteness: 80, contentReadiness: 70, topIssues: [] },
  },
})
await Promise.resolve()
await Promise.resolve()
assert(!state.get().report, 'stale fieldsVersion must not write report')

state.update(
  {
    inflight: false,
    requestId: '',
    report: null,
    fieldsVersion: 3,
    fields: { productName: 'MT-8800', url: 'https://www.made-in-china.com/product/a.html' },
    product: { product: { name: 'MT-8800' } },
  },
  'test:reset-ok',
)
window.ASD.sidepanel.actions.setAnalyzeBusy(false)
window.ASD.sidepanel.app.render()
btn.click()
assert(analyzeHttp === 3, 'success analyze http=' + analyzeHttp)
const okId = lastAnalyzeMsg.requestId
const okResolve = analyzeResolve
okResolve({
  ok: true,
  requestId: okId,
  fieldsVersion: 3,
  result: {
    summary: { oneLine: 'fresh', identity: 'MT-8800', confidence: 88, dataCompleteness: 80, contentReadiness: 70, topIssues: [] },
    identityCandidates: [],
    facts: [],
    keywords: { current: [], suggested: [] },
    content: { title: '', selling: '', detail: { overview: '' }, geo: '' },
    debug: {},
  },
})
await new Promise((r) => setTimeout(r, 30))
assert(
  state.get().report && state.get().report.summary.oneLine === 'fresh',
  'current request must write report, got ' + JSON.stringify(state.get().report && state.get().report.summary),
)
assert(state.get().inflight === false, 'inflight must clear after success, inflight=' + state.get().inflight)

const beforeRetryHttp = analyzeHttp
const beforeRetryReads = readCalls
window.chrome.runtime.sendMessage = function (msg) {
  if (msg.type === 'REQUEST_URL_FIELDS' || msg.type === 'REQUEST_MIC_FIELDS' || msg.type === 'EXTRACT_MIC_FIELDS') {
    readCalls += 1
    return Promise.resolve({ ok: true, fields: { productName: 'should-not-reread' } })
  }
  if (msg.type === 'ANALYZE_PRODUCT') {
    analyzeHttp += 1
    lastAnalyzeMsg = msg
    return Promise.resolve({
      ok: false,
      reason: 'AI timeout',
      code: 'AI_ERROR',
      requestId: msg.requestId,
      fieldsVersion: msg.fieldsVersion,
    })
  }
  return Promise.resolve({ ok: false, reason: 'unexpected ' + msg.type })
}
state.update(
  {
    fields: { productName: 'kept' },
    product: { product: { name: 'kept' } },
    error: 'AI timeout',
    inflight: false,
    requestId: '',
    report: null,
    fieldsVersion: 5,
  },
  'test:ai-fail',
)
window.ASD.sidepanel.actions.setAnalyzeBusy(false)
window.ASD.sidepanel.app.render()
window.document.querySelector('[data-action="analyze"]').click()
await Promise.resolve()
await Promise.resolve()
assert(readCalls === beforeRetryReads, 'AI retry must not re-read page, readCalls=' + readCalls)
assert(analyzeHttp === beforeRetryHttp + 1, 'AI retry must still send analyze, http=' + analyzeHttp)
assert(state.get().fields.productName === 'kept', 'existing fields must be reused')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    sharedHttp,
    tenClicksHttp: 1,
    analyzeHttp,
    readCallsOnRetry: 0,
  }),
)
