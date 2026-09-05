#!/usr/bin/env node
/**
 * Live DeepSeek / Kimi regression. Requires DEEPSEEK_API_KEY and/or KIMI_API_KEY.
 * Does not fail the default offline suite when keys are absent.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadContentScripts, mockChrome } from './lib/load-content.mjs'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deepseekKey = process.env.DEEPSEEK_API_KEY || ''
const kimiKey = process.env.KIMI_API_KEY || ''

function collectFixture(file, url) {
  const html = fs.readFileSync(path.join(root, 'tests/fixtures', file), 'utf8')
  const dom = new JSDOM(html, { url: url, pretendToBeVisual: true, runScripts: 'outside-only' })
  mockChrome(dom.window)
  loadContentScripts(dom.window, root)
  return dom.window.collectDualTrack()
}

function loadAnalyze(settings) {
  const sandbox = {
    ASD: {},
    console: console,
    fetch: fetch,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    crypto: crypto,
    chrome: {
      storage: {
        local: {
          get: async function () {
            return Object.assign({}, settings)
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
    'shared/image-score.js',
    'shared/health-score.js',
    'background/settings.js',
    'background/prompt-builder.js',
    'background/payload-builder.js',
    'background/image-fetcher.js',
    'background/ai-client.js',
    'background/request-registry.js',
    'background/message-handler.js',
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  })
  return sandbox
}

function leak(text, needles) {
  const hay = String(text || '')
  return needles.filter(function (item) {
    return hay.indexOf(item) !== -1
  })
}

const mic = collectFixture('01-mic-product-detail.html', 'https://sample.made-in-china.com/product/canister-vacuum-cleaner-20l.html')
const vemic = collectFixture('02-vemic-product-edit.html', 'https://sample.vemic.com/product/edit?id=8823910')
mic.fields.description = (mic.fields.description || '') + ' contact leak-test@example.com +1-202-555-0147 token=sk-live-LEAKTEST id=110101199001011234 card=4111111111111111'
if (mic.product && mic.product.product) {
  mic.product.product.description = (mic.product.product.description || '') + ' leak-test@example.com'
}

const preview = loadAnalyze({
  provider: 'deepseek',
  deepseekApiKey: 'preview',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModel: 'deepseek-v4-flash',
  deepseekThinking: 'disabled',
})
const built = preview.ASD.bg.payloadBuilder.buildAnalyzePayload(mic.product, mic.fields)
const safe = preview.ASD.sanitize.sanitizePayload([{ role: 'user', content: built.text }])
const leaked = leak(JSON.stringify(safe), ['leak-test@example.com', 'sk-live-LEAKTEST', '4111111111111111', '110101199001011234'])

const results = {
  ok: true,
  payloadPiiLeaks: leaked,
  deepseek: { status: deepseekKey ? 'RUN' : 'PENDING', reason: deepseekKey ? '' : 'DEEPSEEK_API_KEY missing' },
  kimi: { status: kimiKey ? 'RUN' : 'PENDING', reason: kimiKey ? '' : 'KIMI_API_KEY missing' },
  cases: {},
}

async function runProvider(name, settings, bundle, expectName) {
  const sandbox = loadAnalyze(settings)
  const out = await sandbox.ASD.bg.messageHandler.handle({
    type: 'ANALYZE_PRODUCT',
    fields: bundle.fields,
    product: bundle.product,
    requestId: 'real_' + name,
    fieldsVersion: 1,
  })
  if (!out || !out.ok) throw new Error((out && out.reason) || 'ANALYZE failed')
  const summary = (out.result && out.result.summary) || {}
  const identity = String(summary.identity || '')
  if (!new RegExp(expectName, 'i').test(identity)) {
    throw new Error(name + ' identity mismatch: ' + identity)
  }
  if (typeof summary.confidence !== 'number') throw new Error(name + ' missing confidence')
  if (!Array.isArray(out.result.facts)) throw new Error(name + ' facts missing')
  if (!out.result.keywords || !out.result.content) throw new Error(name + ' keywords/content missing')
  const health = sandbox.ASD.healthScore.compute(bundle.product, out.result)
  if (typeof health.total !== 'number') throw new Error(name + ' health missing')
  const blob = JSON.stringify(out.result)
  const rawPii = leak(blob, ['leak-test@example.com', 'sk-live-LEAKTEST'])
  if (rawPii.length) throw new Error(name + ' result leaked ' + rawPii.join(','))
  return {
    identity: identity,
    confidence: summary.confidence,
    facts: out.result.facts.length,
    repaired: out.schemaRepaired || [],
    health: health.total,
    payloadMode: out.payloadMode,
  }
}

if (leaked.length) {
  results.ok = false
  results.error = 'payload still contains raw PII'
}

if (results.ok && deepseekKey) {
  try {
    results.cases.deepseekMic = await runProvider(
      'deepseek-mic',
      {
        provider: 'deepseek',
        deepseekApiKey: deepseekKey,
        deepseekBaseUrl: 'https://api.deepseek.com',
        deepseekModel: 'deepseek-v4-flash',
        deepseekThinking: 'disabled',
      },
      mic,
      'vacuum|cleaner|canister',
    )
    results.cases.deepseekVemic = await runProvider(
      'deepseek-vemic',
      {
        provider: 'deepseek',
        deepseekApiKey: deepseekKey,
        deepseekBaseUrl: 'https://api.deepseek.com',
        deepseekModel: 'deepseek-v4-flash',
        deepseekThinking: 'disabled',
      },
      vemic,
      'vacuum|cleaner|steam',
    )
    results.deepseek.status = 'PASS'
  } catch (error) {
    results.ok = false
    results.deepseek.status = 'FAIL'
    results.deepseek.reason = error.message || String(error)
  }
}

if (results.ok && kimiKey) {
  try {
    results.cases.kimiMic = await runProvider(
      'kimi-mic',
      {
        provider: 'kimi',
        kimiApiKey: kimiKey,
        kimiBaseUrl: 'https://api.moonshot.cn/v1',
        kimiModel: 'kimi-k2.5',
      },
      mic,
      'vacuum|cleaner|canister',
    )
    results.kimi.status = 'PASS'
  } catch (error) {
    results.ok = false
    results.kimi.status = 'FAIL'
    results.kimi.reason = error.message || String(error)
  }
}

console.log(JSON.stringify(results, null, 2))
if (!results.ok) process.exit(1)
if (results.deepseek.status === 'PENDING' && results.kimi.status === 'PENDING') process.exit(2)
