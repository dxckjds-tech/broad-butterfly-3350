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

function extract(html, url) {
  const dom = new JSDOM(html, { url: url, pretendToBeVisual: true, runScripts: 'outside-only' })
  mockChrome(dom.window)
  loadContentScripts(dom.window, root)
  const fields = dom.window.extractFields()
  const product = dom.window.ASD.content.extractors.extractAll()
  const score = dom.window.ASD.productFields.qualityScore(fields, product)
  product.debug.finalQualityScore = score
  return { fields, product, score, window: dom.window }
}

const html = fs.readFileSync(path.join(root, 'tests/fixtures/10-mic-membercenter-edit.html'), 'utf8')
const mic = extract(html, 'https://membercenter.made-in-china.com/productmanage/product/edit?prodId=8823910')
const hits = mic.product.debug.selectorHits || {}
assert(mic.product.debug.productRootFound, 'membercenter productRootFound')
assert(mic.product.debug.site === 'mic', 'membercenter site')
assert(mic.product.product.name === 'Stainless Steel Ball Valve DN50 MIC Editor', 'title value: ' + mic.product.product.name)
assert(hits.title === 'input[name="prodName"]' || hits.title === 'input[id="prodName"]', 'title selector: ' + hits.title)
assert(/Ball Valves/.test(mic.product.product.category || ''), 'category value: ' + mic.product.product.category)
assert(
  hits.category === '.cate-selected' || /^label:/.test(hits.category || '') || /cate-selected|catName|catCode/.test(hits.category || ''),
  'category selector: ' + hits.category,
)
assert(hits.specifications === 'table tr', 'specifications must stay table tr: ' + hits.specifications)
assert(mic.product.product.specifications.length >= 5, 'specifications count: ' + mic.product.product.specifications.length)
assert(hits.description === 'textarea[name*="desc" i]', 'description selector: ' + hits.description)
assert(/ANSI B16.10/.test(mic.product.product.description || ''), 'description text')
assert(mic.score > 60, 'finalQualityScore should beat 60, got ' + mic.score)
assert(mic.score >= 80, 'finalQualityScore should be clearly above 60, got ' + mic.score)
assert(hits.productRoot !== 'body' && hits.productRoot !== 'html', 'must not fall back to document.body: ' + hits.productRoot)

const fieldMapSrc = fs.readFileSync(path.join(root, 'content/field-map.js'), 'utf8')
const extractorSrc = fs.readFileSync(path.join(root, 'content/extractors.js'), 'utf8')
assert(/input\[name="prodName"\]/.test(fieldMapSrc), 'prodName selector must live in field-map')
assert(/\.cate-selected/.test(fieldMapSrc), 'cate-selected selector must live in field-map')
assert(!/prodName/.test(extractorSrc), 'extractors must not hardcode prodName')
assert(!/cate-selected/.test(extractorSrc), 'extractors must not hardcode cate-selected')

const labelHtml = `<!DOCTYPE html><html><body>
<form id="productForm" class="product-edit-form">
  <label>产品名称<input type="text" value="Label Recovered Pump"></label>
  <div class="form-item">
    <label>产品目录</label>
    <span class="cate-selected">Pumps &gt; Water Pumps</span>
  </div>
  <table><tr><th>Power</th><td>750W</td></tr></table>
  <textarea name="description">Label description</textarea>
</form></body></html>`
const labeled = extract(labelHtml, 'https://membercenter.made-in-china.com/product/edit')
assert(labeled.product.product.name === 'Label Recovered Pump', 'label title: ' + labeled.product.product.name)
assert(/^label:/.test(labeled.product.debug.selectorHits.title || ''), 'label title source: ' + labeled.product.debug.selectorHits.title)
assert(/Water Pumps/.test(labeled.product.product.category || ''), 'label category: ' + labeled.product.product.category)

const jsonHtml = `<!DOCTYPE html><html><head>
<script type="application/json">{"prodName":"JSON Recovered Compressor","catName":"Air Compressors"}</script>
</head><body>
<form id="productForm" class="product-edit-form">
  <table><tr><th>Air Flow</th><td>200L/min</td></tr></table>
  <textarea name="prodDesc">JSON description remains.</textarea>
</form></body></html>`
const stated = extract(jsonHtml, 'https://membercenter.made-in-china.com/product/edit')
assert(stated.product.product.name === 'JSON Recovered Compressor', 'json title: ' + stated.product.product.name)
assert(stated.product.debug.selectorHits.title === 'json:prodName', 'json title source: ' + stated.product.debug.selectorHits.title)
assert(stated.product.product.category === 'Air Compressors', 'json category: ' + stated.product.product.category)
assert(stated.product.debug.selectorHits.category === 'json:catName', 'json category source: ' + stated.product.debug.selectorHits.category)
assert(/JSON description remains/.test(stated.product.product.description || ''), 'json path must not drop description')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    title: mic.product.product.name,
    titleHit: hits.title,
    category: mic.product.product.category,
    categoryHit: hits.category,
    score: mic.score,
    specs: mic.product.product.specifications.length,
    descriptionHit: hits.description,
  }),
)
