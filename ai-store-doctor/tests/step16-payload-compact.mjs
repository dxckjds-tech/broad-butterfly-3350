#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

function loadBg() {
  const dom = new JSDOM('<html></html>', { url: 'https://sample.made-in-china.com/', runScripts: 'outside-only' })
  ;['shared/constants.js', 'shared/error-codes.js', 'shared/payload-compactor.js', 'background/payload-builder.js', 'background/message-handler.js'].forEach(
    function (file) {
      dom.window.eval(fs.readFileSync(path.join(root, file), 'utf8'))
    },
  )
  return dom.window.ASD
}

function loadPanel() {
  const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8')
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])
  const chrome = {
    runtime: { sendMessage: async () => ({ ok: false }) },
    storage: { local: { async get() { return {} }, async set() {}, async remove() {} } },
  }
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), {
    url: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sidepanel.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  dom.window.chrome = chrome
  scripts.forEach(function (src) {
    dom.window.eval(fs.readFileSync(path.join(root, src), 'utf8'))
  })
  return dom
}

function hugeSpecs(count, valueChars, extra) {
  return Array.from({ length: count }, function (_, i) {
    return Object.assign(
      { name: 'Spec ' + i, value: String(i) + 'v'.repeat(valueChars) },
      extra || {},
    )
  })
}

function payloadBase(extraProduct, extraRoot) {
  return Object.assign(
    {
      product: Object.assign(
        {
          name: 'Canister Vacuum Cleaner 20L',
          category: 'Vacuum Cleaners',
          model: 'VC-20L',
          sku: 'SKU-20L',
          material: 'ABS',
          power: '1200W',
          voltage: '220V',
          capacity: '20L',
          moq: '100',
          keywords: ['vacuum', 'canister', 'vacuum', 'cleaner'],
          specifications: [],
          description: 'Para one.\n\nPara two.\n\nPara three.',
          applications: ['home', 'home', 'office', 'hotel', 'shop', 'factory', 'warehouse', 'school'],
          certifications: ['CE', 'CE', 'RoHS', 'ISO', 'UL', 'CCC', 'GS'],
        },
        extraProduct || {},
      ),
      company: { name: 'Acme', profile: 'About us.\n\nWe make vacuums.\n\nMore fluff.', address: 'X', phone: '123' },
      current: { title: 'Canister Vacuum Cleaner 20L', keywords: ['vacuum cleaner', '20L'], description: 'Listing' },
      fallbackText: 'Fallback paragraph one.\n\nFallback paragraph two.\n\nFallback paragraph three.',
    },
    extraRoot || {},
  )
}

const ASD = loadBg()
const compact = ASD.payloadCompactor
const builder = ASD.bg.payloadBuilder
const classify = ASD.bg.messageHandler.classify

assert(!!compact && typeof compact.fitToBudget === 'function', 'payloadCompactor missing')
assert(compact.PROFILES.join(',') === 'FULL,COMPACT,MINIMAL', 'profiles')

const banned = [
  'shared/payload-compactor.js',
  'background/payload-builder.js',
  'background/message-handler.js',
].some(function (file) {
  return /JSON\.stringify[\s\S]{0,120}\.slice\s*\(/.test(fs.readFileSync(path.join(root, file), 'utf8'))
})
assert(!banned, 'JSON.stringify(...).slice(...) must not return')

const compactOver = payloadBase({
  specifications: hugeSpecs(40, 80),
  description: Array.from({ length: 12 }, function (_, i) { return 'Description paragraph ' + i + ' ' + 'd'.repeat(200) }).join('\n\n'),
}, {
  fallbackText: Array.from({ length: 10 }, function (_, i) { return 'Fallback ' + i + ' ' + 'F'.repeat(1800) }).join('\n\n'),
  company: { name: 'Acme', profile: 'p'.repeat(9000), address: 'Y', employees: '500' },
})
const compactImages = [1, 2, 3, 4, 5].map(function (n) { return { src: 'https://img.made-in-china.com/p' + n + '.jpg' } })
assert(JSON.stringify(compactOver).length > builder.MAX_PAYLOAD_CHARS, 'compact fixture must exceed FULL')
const compactFit = compact.fitToBudget(compactOver, { maxChars: builder.MAX_PAYLOAD_CHARS, images: compactImages })
assert(compactFit.overBudget === false, 'COMPACT should fit')
assert(compactFit.profile === 'COMPACT', 'expected COMPACT, got ' + compactFit.profile)
JSON.parse(compactFit.text)
assert(compactFit.object.product.name === 'Canister Vacuum Cleaner 20L', 'compact kept name')
assert(compactFit.object.product.sku === 'SKU-20L', 'compact kept sku')
assert(compactFit.object.current.title === 'Canister Vacuum Cleaner 20L', 'compact kept current.title')
assert(compactFit.images.length === 2, 'COMPACT images should be 2, got ' + compactFit.images.length)
assert(compactFit.debug.imageCountBefore === 5, 'imageCountBefore')
assert(compactFit.debug.imageCountAfter === 2, 'imageCountAfter')
assert(compactFit.debug.payloadProfile === 'COMPACT', 'debug profile')
assert(typeof compactFit.debug.originalEstimatedTokens === 'number', 'originalEstimatedTokens')
assert(typeof compactFit.debug.finalEstimatedTokens === 'number', 'finalEstimatedTokens')
assert(JSON.stringify(compactFit.debug).indexOf('Fallback ') === -1, 'debug must not store fallback text')
assert(JSON.stringify(compactFit.debug).indexOf(compactOver.fallbackText.slice(0, 40)) === -1, 'debug leaked fallback')

const minimalOver = payloadBase({
  specifications: hugeSpecs(20, 2200),
  description: Array.from({ length: 8 }, function (_, i) { return 'Long description paragraph ' + i + ' ' + 'D'.repeat(400) }).join('\n\n'),
})
assert(JSON.stringify(compact.applyProfile(minimalOver, 'COMPACT', {}).object).length > builder.MAX_PAYLOAD_CHARS, 'COMPACT of minimal fixture should still exceed')
const minimalFit = compact.fitToBudget(minimalOver, { maxChars: builder.MAX_PAYLOAD_CHARS, images: compactImages })
assert(minimalFit.overBudget === false, 'MINIMAL should fit')
assert(minimalFit.profile === 'MINIMAL', 'expected MINIMAL, got ' + minimalFit.profile)
JSON.parse(minimalFit.text)
assert(minimalFit.object.product.name === 'Canister Vacuum Cleaner 20L', 'minimal kept name')
assert(minimalFit.object.product.power === '1200W', 'minimal kept power')
assert(minimalFit.images.length === 1, 'MINIMAL images should be 1, got ' + minimalFit.images.length)
assert(minimalFit.debug.imageCountAfter === 1, 'minimal imageCountAfter')

const stillOver = payloadBase({
  specifications: hugeSpecs(20, 1800).map(function (row, i) {
    return Object.assign(row, { status: 'VERIFIED', field: 'extra' + i })
  }),
})
const stillFit = compact.fitToBudget(stillOver, { maxChars: builder.MAX_PAYLOAD_CHARS, images: compactImages })
assert(stillFit.overBudget === true, 'MINIMAL should still exceed')
assert(stillFit.profile === 'MINIMAL', 'over-budget profile')
let thrown = null
try {
  builder.enforceBudget(stillOver, { images: compactImages })
} catch (error) {
  thrown = error
}
assert(thrown && thrown.code === 'PAYLOAD_BUDGET_EXCEEDED', 'enforceBudget code')
assert(thrown && thrown.message === compact.PAYLOAD_BUDGET_MESSAGE, 'Chinese budget message')
assert(classify(thrown) === 'PAYLOAD_BUDGET_EXCEEDED', 'classify PAYLOAD_BUDGET_EXCEEDED, got ' + classify(thrown))
assert(classify({ message: 'PAYLOAD_BUDGET_EXCEEDED' }) === 'PAYLOAD_BUDGET_EXCEEDED', 'classify message code')
assert(classify({ code: 'AUTH_ERROR', message: 'invalid api key' }) === 'AUTH_ERROR', 'classify AUTH_ERROR')
assert(classify({ code: 'API_KEY_MISSING' }) === 'API_KEY_MISSING', 'classify API_KEY_MISSING')
assert(classify({ code: 'COLLECTION_INCOMPLETE' }) === 'COLLECTION_INCOMPLETE', 'classify COLLECTION_INCOMPLETE')

const ugly = payloadBase({
  description: 'Quote "inner" and slash \\ and emoji 😀\n\nSecond paragraph with \u2028 line.',
  specifications: [
    { name: 'Material', value: 'Steel "304"', status: 'VERIFIED' },
    { name: 'Noise', value: 'x'.repeat(4000) },
  ],
})
const uglyFit = compact.fitToBudget(ugly, { maxChars: 1200, images: compactImages })
JSON.parse(uglyFit.text)
assert(uglyFit.object.product.specifications.some(function (row) {
  return row.status === 'VERIFIED' && /Steel/.test(row.value)
}), 'VERIFIED spec kept')
assert(uglyFit.object.product.material === 'ABS', 'core material kept')
assert(uglyFit.object.product.voltage === '220V', 'core voltage kept')
assert(uglyFit.object.product.capacity === '20L', 'core capacity kept')
assert(uglyFit.object.product.moq === '100', 'core moq kept')
assert(uglyFit.object.current.keywords.indexOf('vacuum cleaner') >= 0, 'current.keywords kept')

const built = builder.buildAnalyzePayload(
  { product: compactOver.product, company: compactOver.company, current: compactOver.current, fallbackText: compactOver.fallbackText, images: compactImages },
  { title: compactOver.current.title },
  { images: compactImages },
)
assert(built.mode === 'product', 'build mode')
assert(built.profile === 'FULL' || built.profile === 'COMPACT' || built.profile === 'MINIMAL', 'build profile ' + built.profile)
assert(built.object.fallbackText == null || built.object.fallbackText.length <= 1200, 'payload fallback must stay bounded')
assert(!built.object.visibleText, 'payload must not send visibleText')
assert(!built.object.formFields || !built.object.formFields.length, 'payload must not send formFields')
JSON.parse(built.text)
assert(built.object.product.name === 'Canister Vacuum Cleaner 20L', 'built name')
assert(built.payloadDebug && !/F{20}/.test(JSON.stringify(built.payloadDebug)), 'built debug no fallback blob')

const panel = loadPanel()
const app = panel.window.ASD.sidepanel.app
app.render()
panel.window.ASD.sidepanel.state.update(
  {
    error: compact.PAYLOAD_BUDGET_MESSAGE,
    meta: { code: 'PAYLOAD_BUDGET_EXCEEDED' },
    loading: false,
    report: null,
  },
  'cta:payload',
)
app.render()
const payloadHtml = panel.window.document.getElementById('summary').innerHTML
assert(payloadHtml.indexOf('打开 API 设置') === -1, 'PAYLOAD CTA must not open API settings')
assert(payloadHtml.indexOf('重新压缩并分析') >= 0, 'PAYLOAD CTA recompress')
assert(payloadHtml.indexOf('切换模型') >= 0, 'PAYLOAD CTA switch model')
assert(payloadHtml.indexOf('data-action="analyze"') >= 0, 'PAYLOAD analyze action')

panel.window.ASD.sidepanel.state.update(
  { error: 'API Key 无效', meta: { code: 'AUTH_ERROR' }, loading: false, report: null },
  'cta:auth',
)
app.render()
const authHtml = panel.window.document.getElementById('summary').innerHTML
assert(authHtml.indexOf('打开 API 设置') >= 0, 'AUTH CTA must open API settings')

panel.window.ASD.sidepanel.state.update(
  { error: '模型不存在', meta: { code: 'MODEL_NOT_FOUND' }, loading: false, report: null },
  'cta:model',
)
app.render()
assert(panel.window.document.getElementById('summary').innerHTML.indexOf('打开模型设置') >= 0, 'MODEL CTA')

panel.window.ASD.sidepanel.state.update(
  { error: '采集不完整', meta: { code: 'COLLECTION_INCOMPLETE' }, loading: false, report: null },
  'cta:collect',
)
app.render()
const collectHtml = panel.window.document.getElementById('summary').innerHTML
assert(collectHtml.indexOf('重新读取页面') >= 0, 'COLLECTION CTA')
assert(collectHtml.indexOf('打开 API 设置') === -1, 'COLLECTION CTA must not open API settings')

const warning = panel.window.ASD.sidepanel.actions.collectWarningText({
  debug: {
    collectGaps: ['title'],
    productRootFound: false,
    finalQualityScore: 12,
    selectorHits: { title: null, category: '.crumb', specifications: 'table', description: null },
  },
})
assert(/可能不完整/.test(warning), 'collect warning stem')
assert(/productRootFound=false/.test(warning), 'warning root')
assert(/finalQualityScore=12/.test(warning), 'warning score')
assert(/selectorHits.title=null/.test(warning), 'warning title hit')
assert(/selectorHits.category=\.crumb/.test(warning), 'warning category hit')
assert(/selectorHits.specifications=table/.test(warning), 'warning specs hit')
assert(/selectorHits.description=null/.test(warning), 'warning desc hit')

const actionsSrc = fs.readFileSync(path.join(root, 'sidepanel/actions.js'), 'utf8')
assert(/forceResample/.test(actionsSrc), 'actions forceResample')
assert(/read:force-resample/.test(actionsSrc), 'force resample bumps fieldsVersion first')
const appSrc = fs.readFileSync(path.join(root, 'sidepanel/app.js'), 'utf8')
assert(/forceResample:\s*true/.test(appSrc), 'reload-fields forces resample')
const contentSrc = fs.readFileSync(path.join(root, 'content-script.js'), 'utf8')
assert(/forceResample/.test(contentSrc) && /resetSession/.test(contentSrc), 'content force resample')
const dynSrc = fs.readFileSync(path.join(root, 'content/dynamic-collect.js'), 'utf8')
assert(/function resetSession/.test(dynSrc), 'dynamic resetSession')
assert(/MutationObserver/.test(dynSrc), 'keep MutationObserver')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    compactProfile: compactFit.profile,
    minimalProfile: minimalFit.profile,
    stillOver: stillFit.overBudget,
    compactImages: compactFit.images.length,
    minimalImages: minimalFit.images.length,
  }),
)
