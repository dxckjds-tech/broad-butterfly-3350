#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadContentScripts, mockChrome } from './lib/load-content.mjs'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

function loadPage(html, url) {
  const dom = new JSDOM(html, { url: url, pretendToBeVisual: true, runScripts: 'outside-only' })
  mockChrome(dom.window)
  loadContentScripts(dom.window, root)
  return dom
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

const case1 = loadPage(
  `<!DOCTYPE html><html><body>
  <main class="product-main">
    <h1 id="title"></h1>
    <div data-field="description">Steel ball valve for pipelines.</div>
  </main>
  </body></html>`,
  'https://sample.made-in-china.com/product/valve.html',
)
setTimeout(function () {
  case1.window.document.getElementById('title').textContent = 'DN50 Stainless Steel Ball Valve'
}, 500)
const case1Out = await case1.window.ASD.content.dynamic.collectUntilStable()
assert(case1Out.product.product.name === 'DN50 Stainless Steel Ball Valve', 'case1 title not collected: ' + (case1Out.product.product.name || 'null'))
assert(case1Out.product.debug.productRootFound, 'case1 root')

const case2 = loadPage(
  `<!DOCTYPE html><html><body>
  <main class="product-main">
    <h1>DN50 Ball Valve</h1>
    <div data-field="description">Industrial valve.</div>
    <div id="spec-slot"></div>
  </main>
  </body></html>`,
  'https://sample.made-in-china.com/product/valve2.html',
)
const before = case2.window.collectDualTrack()
const beforeScore = before.product.debug.qualityScore
setTimeout(function () {
  case2.window.document.getElementById('spec-slot').innerHTML =
    '<table><tr><th>Size</th><td>DN50</td></tr><tr><th>Material</th><td>SS304</td></tr><tr><th>Pressure</th><td>PN16</td></tr></table>'
}, 200)
const case2Out = await case2.window.ASD.content.dynamic.collectUntilStable()
assert(case2Out.product.product.specifications.length >= 2, 'case2 specs not collected: ' + case2Out.product.product.specifications.length)
assert(
  (case2Out.product.debug.finalQualityScore || case2Out.product.debug.qualityScore) > beforeScore,
  'case2 quality did not rise: ' + beforeScore + ' -> ' + case2Out.product.debug.finalQualityScore,
)

const case3 = loadPage(
  `<!DOCTYPE html><html><body>
  <main class="product-main"><p id="slot">loading</p></main>
  </body></html>`,
  'https://sample.made-in-china.com/product/churn.html',
)
const case3Promise = case3.window.ASD.content.dynamic.collectUntilStable()
await sleep(30)
for (let i = 0; i < 10; i += 1) {
  case3.window.document.getElementById('slot').textContent = 'tick-' + i
}
await sleep(600)
const case3During = case3.window.ASD.content.dynamic.extractCount
assert(case3During <= 3, 'case3 debounce window extracts too high: ' + case3During)
const case3Out = await case3Promise
assert(case3.window.ASD.content.dynamic.extractCount < 10, 'case3 extractCount too high: ' + case3.window.ASD.content.dynamic.extractCount)
assert(case3Out.product.debug.sampleCount < 10, 'case3 sampleCount too high: ' + case3Out.product.debug.sampleCount)
assert(case3Out.product.debug.observerTriggeredCount >= 1, 'case3 observer should fire')

const case4 = loadPage('<!DOCTYPE html><html><body><p>help page</p></body></html>', 'https://sample.made-in-china.com/help.html')
const case4Started = Date.now()
const case4Out = await case4.window.ASD.content.dynamic.collectUntilStable()
const case4Ms = Date.now() - case4Started
assert(case4Out.product.debug.productRootFound === false, 'case4 should not find productRoot')
assert(case4Ms < 2500, 'case4 waited too long: ' + case4Ms)

const fullHtml = fs.readFileSync(path.join(root, 'tests/fixtures/01-mic-product-detail.html'), 'utf8')
const case5 = loadPage(fullHtml, 'https://sample.made-in-china.com/product/canister-vacuum-cleaner-20l.html')
const case5Started = Date.now()
const case5Out = await case5.window.ASD.content.dynamic.collectUntilStable()
const case5Ms = Date.now() - case5Started
assert(case5Out.product.debug.completeProduct, 'case5 should be complete')
assert(case5Ms < 1500, 'case5 should finish quickly, took ' + case5Ms)
assert(case5Out.product.debug.sampleCount <= 4, 'case5 extra samples: ' + case5Out.product.debug.sampleCount)
assert(typeof case5Out.product.debug.readDurationMs === 'number', 'case5 readDurationMs')
assert(typeof case5Out.product.debug.finalQualityScore === 'number', 'case5 finalQualityScore')
assert(case5Out.product.debug.selectorHits && case5Out.product.debug.selectorHits.title === 'h1', 'case5 title hit: ' + JSON.stringify(case5Out.product.debug.selectorHits))
assert(case5Out.product.debug.selectorHits.category === '.category-breadcrumb', 'case5 category hit')
assert(
  case5Out.product.debug.selectorHits.productRoot === '.product-main' ||
    case5Out.product.debug.selectorHits.productRoot === 'main.product-main' ||
    case5Out.product.debug.selectorHits.productRoot === 'main',
  'case5 root hit: ' + case5Out.product.debug.selectorHits.productRoot,
)

const noRootGaps = case4.window.ASD.productFields.collectGaps(case4Out.fields, case4Out.product)
assert(noRootGaps.indexOf('productRoot') !== -1, 'gaps should include productRoot')
assert(noRootGaps.indexOf('title') !== -1, 'gaps should include title')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    case1: case1Out.product.product.name,
    case2Quality: { before: beforeScore, after: case2Out.product.debug.finalQualityScore, specs: case2Out.product.product.specifications.length },
    case3: { extracts: case3.window.ASD.content.dynamic.extractCount, observer: case3Out.product.debug.observerTriggeredCount },
    case4: { productRootFound: false, ms: case4Ms },
    case5: {
      ms: case5Ms,
      samples: case5Out.product.debug.sampleCount,
      quality: case5Out.product.debug.finalQualityScore,
      hits: case5Out.product.debug.selectorHits,
    },
  }),
)
