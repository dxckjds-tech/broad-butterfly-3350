#!/usr/bin/env node
/**
 * Step 9.1 — rejected images never become vision URLs; sanitizer fail-closed.
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

function loadFetcher(fetchImpl) {
  const sandbox = {
    ASD: {},
    console,
    fetch: fetchImpl,
    URL,
    btoa,
    Uint8Array,
    String,
    Math,
  }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  for (const file of ['shared/constants.js', 'shared/image-score.js', 'background/image-fetcher.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  }
  return sandbox
}

function productImg(src, extra) {
  return Object.assign(
    {
      src: src,
      alt: 'Industrial Ball Valve DN50',
      width: 400,
      height: 400,
      naturalWidth: 400,
      naturalHeight: 400,
      area: 160000,
      className: '',
      id: '',
      parentTag: 'MAIN',
      parentClass: 'product-main',
      insideProductRoot: true,
      insideHeader: false,
      insideFooter: false,
      insideNav: false,
      nearProductTitle: true,
      score: 80,
    },
    extra || {},
  )
}

function okImageResponse() {
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 16, 1, 2, 3, 4])
  return {
    ok: true,
    blob: async function () {
      return {
        type: 'image/jpeg',
        size: bytes.length,
        arrayBuffer: async function () {
          return bytes.buffer
        },
      }
    },
  }
}

const fetchLog = []
const sandbox = loadFetcher(async function (href, init) {
  fetchLog.push({ href: String(href), credentials: init && init.credentials })
  if (String(href).indexOf('fail-http') !== -1) return { ok: false, blob: async function () { return { type: 'image/jpeg', size: 1, arrayBuffer: async function () { return new ArrayBuffer(1) } } } }
  return okImageResponse()
})
const fetcher = sandbox.ASD.bg.imageFetcher

const caseA = 'https://img.made-in-china.com/order/customer.jpg'
const caseB = 'https://img.made-in-china.com/license/business-license.jpg'
const caseC = 'https://img.made-in-china.com/avatar/user.png'
const caseD = 'https://evil.example/image.jpg'
const caseE = 'https://img.made-in-china.com/sample/ball-valve-dn50.jpg'
const caseFail = 'https://img.made-in-china.com/sample/fail-http.jpg'
const caseToken = 'https://img.made-in-china.com/sample/ball-valve-dn50.jpg?token=secret-token-value'

assert((await fetcher.imageAsDataUrl(caseA)) === null, 'A imageAsDataUrl must be null')
assert((await fetcher.imageAsDataUrl(caseB)) === null, 'B imageAsDataUrl must be null')
assert((await fetcher.imageAsDataUrl(caseC)) === null, 'C imageAsDataUrl must be null')
assert((await fetcher.imageAsDataUrl(caseD)) === null, 'D imageAsDataUrl must be null')
const okData = await fetcher.imageAsDataUrl(caseE, { allowCredentials: true, score: 80 })
assert(typeof okData === 'string' && okData.indexOf('data:image/') === 0, 'E must be data:image')
assert(!/^https?:/i.test(okData), 'E must not return remote URL')

const packDeny = await fetcher.fetchVisionImages([
  productImg(caseA),
  productImg(caseB),
  productImg(caseC),
  productImg(caseD, { insideProductRoot: false }),
])
const denyJoined = JSON.stringify(packDeny.urls)
assert(packDeny.urls.every(function (url) { return String(url).indexOf('data:image/') === 0 }), 'visionUrls must only be data URLs')
assert(denyJoined.indexOf('/order/customer.jpg') === -1, 'A order path leaked')
assert(denyJoined.indexOf('license') === -1, 'B license leaked')
assert(denyJoined.indexOf('avatar') === -1, 'C avatar leaked')
assert(denyJoined.indexOf('evil.example') === -1, 'D evil host leaked')
assert(packDeny.urls.length === 0, 'A-D must not enter visionUrls, got ' + packDeny.urls.length)
assert(fetchLog.every(function (row) { return row.href.indexOf('evil.example') === -1 }), 'D must not fetch')

fetchLog.length = 0
const packOk = await fetcher.fetchVisionImages([productImg(caseE)])
assert(packOk.urls.length === 1 && packOk.urls[0].indexOf('data:image/') === 0, 'E visionUrls data URL')
assert(packOk.picked.length === 1 && packOk.picked[0].originalSrc === caseE, 'E picked originalSrc')
assert(packOk.picked[0].dataUrl.indexOf('data:image/') === 0, 'E picked dataUrl')
assert(fetchLog.some(function (row) { return row.credentials === 'include' }), 'E score>=40 allowed host gets credentials')

fetchLog.length = 0
const packFail = await fetcher.fetchVisionImages([productImg(caseFail)])
assert(packFail.urls.length === 0, 'failed HTTP must not enter visionUrls')
assert((await fetcher.imageAsDataUrl(caseFail)) === null, 'failed HTTP imageAsDataUrl null')

const packMixed = await fetcher.fetchVisionImages([
  productImg(caseA),
  productImg(caseE),
  productImg(caseB),
])
const pickedSources = new Set(packMixed.picked.map(function (item) { return item.originalSrc }))
const selectedCount = packMixed.ranked.filter(function (img) { return pickedSources.has(img.src) }).length
assert(selectedCount === packMixed.picked.length, 'selected count ' + selectedCount + ' != picked ' + packMixed.picked.length)
assert(pickedSources.has(caseE) && !pickedSources.has(caseA) && !pickedSources.has(caseB), 'only product originalSrc selected')

const redacted = sandbox.ASD.imageScore.redactSrc(caseToken)
assert(redacted.indexOf('secret-token-value') === -1, 'redactSrc leaked token')
assert(!JSON.stringify(packMixed.urls).includes('token='), 'visionUrls must not keep query token')

function loadAiClient(withSanitize) {
  const fetchCalls = []
  const sandboxAi = {
    ASD: { bg: {} },
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: async function () {
      fetchCalls.push(1)
      return { ok: true, json: async function () { return { choices: [{ message: { content: '{"ok":true}' } }] } } }
    },
  }
  sandboxAi.globalThis = sandboxAi
  sandboxAi.ASD.bg.settings = {
    load: async function () {
      return {
        provider: 'deepseek',
        deepseekApiKey: 'sk-test-key',
        deepseekBaseUrl: 'https://api.deepseek.com',
        deepseekModel: 'deepseek-chat',
        deepseekThinking: 'disabled',
      }
    },
  }
  sandboxAi.ASD.bg.payloadBuilder = { sanitizeModelEvidence: function (x) { return x } }
  if (withSanitize) {
    sandboxAi.ASD.sanitize = {
      sanitizePayload: function (messages) {
        return messages
      },
    }
  }
  const ctx = vm.createContext(sandboxAi)
  ;['shared/result-schema.js', 'shared/task-types.js', 'shared/task-validators.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  vm.runInContext(fs.readFileSync(path.join(root, 'background/ai-client.js'), 'utf8'), ctx, { filename: 'ai-client.js' })
  return { sandbox: sandboxAi, fetchCalls: fetchCalls }
}

const missing = loadAiClient(false)
let thrown = ''
try {
  await missing.sandbox.ASD.bg.aiClient.callAI([{ role: 'user', content: 'secret@example.com' }])
} catch (error) {
  thrown = error.message || String(error)
}
assert(thrown === 'SECURITY_SANITIZER_UNAVAILABLE', 'missing sanitizer error: ' + thrown)
assert(missing.fetchCalls.length === 0, 'sanitizer missing must not fetch, got ' + missing.fetchCalls.length)

const present = loadAiClient(true)
try {
  await present.sandbox.ASD.bg.aiClient.callAI([{ role: 'user', content: '{"ping":true}' }])
} catch (error) {
  // schema/JSON path may throw after fetch; fetch must have been attempted
}
assert(present.fetchCalls.length >= 1, 'sanitizer present may fetch')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    cases: { A: 'drop', B: 'drop', C: 'drop', D: 'drop', E: 'data:image' },
    sanitizerMissingFetch: 0,
    selectedMatchesPicked: true,
  }),
)
