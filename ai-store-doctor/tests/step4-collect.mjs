#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadContentScripts, mockChrome } from './lib/load-content.mjs'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturesDir = path.join(root, 'tests', 'fixtures')

function extract(htmlFile, url) {
  const html = fs.readFileSync(path.join(fixturesDir, htmlFile), 'utf8')
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'outside-only' })
  mockChrome(dom.window)
  loadContentScripts(dom.window, root)
  const fields = dom.window.extractFields()
  const product = dom.window.ASD.content.extractors.extractAll()
  product.debug.oldFieldCount = dom.window.ASD.productFields.countOldFields(fields)
  product.debug.newFieldCount = dom.window.ASD.productFields.countNewFields(product)
  const loginRequired = dom.window.ASD.content.dom.detectLoginRequired(product)
  return { fields, product, loginRequired, window: dom.window }
}

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const mic = extract(
  '01-mic-product-detail.html',
  'https://sample.made-in-china.com/product/canister-vacuum-cleaner-20l.html',
)
assert(mic.product.product.name === 'Canister Vacuum Cleaner 20L', '01 name: ' + mic.product.product.name)
assert(mic.product.product.keywords.indexOf('canister vacuum cleaner') !== -1, '01 keywords chip missing')
assert(mic.product.product.keywords.indexOf('portable vacuum') !== -1, '01 keyword-tag missing')
assert(mic.fields.keywords.length === 0, '01 old fields.keywords must stay empty (dual-track)')
assert(mic.product.debug.productRootFound, '01 productRoot')
assert(mic.product.fallbackText.length <= 4000, '01 fallback length')
assert(mic.product.images.length >= 1 && mic.product.images[0].src, '01 image metadata')
assert('insideProductRoot' in mic.product.images[0], '01 image flags')
assert(mic.product.debug.completeProduct, '01 complete product')

const vemic = extract('02-vemic-product-edit.html', 'https://sample.vemic.com/product/edit?id=8823910')
assert(vemic.product.product.name && /Steam Cleaner/.test(vemic.product.product.name), '02 name')
assert(vemic.product.product.keywords.length >= 1, '02 keywords')
assert(vemic.product.product.capacity === '20L' || vemic.product.product.specifications.some((s) => /20/.test(s.value)), '02 capacity')
assert(vemic.product.debug.site === 'vemic', '02 site')
assert(vemic.product.debug.completeProduct, '02 complete')

const list = extract('03-vemic-product-list.html', 'https://sample.vemic.com/product/list')
assert(!list.product.debug.completeProduct, '03 must not be a complete product')
assert(!list.product.product.name, '03 list h1 must not become product name')

const dynamic = extract('04-dynamic-product-page.html', 'https://sample.made-in-china.com/product/loading.html')
assert(!dynamic.product.debug.completeProduct, '04 incomplete')
assert(dynamic.product.fallbackText.length <= 4000, '04 fallback')

const special = extract(
  '05-special-jsonld-iframe.html',
  'https://sample.made-in-china.com/product/industrial-ball-valve-dn50.html',
)
assert(special.product.product.name === 'Industrial Ball Valve DN50', '05 name')
assert(special.product.debug.productRootFound, '05 root')

const hiddenPw = extract('06-hidden-password.html', 'https://sample.made-in-china.com/product/led.html')
assert(hiddenPw.product.product.name === 'LED Panel Light 60x60', '06 name')
assert(!hiddenPw.loginRequired, '06 hidden password must not set loginRequired')

const membercenter = extract(
  '10-mic-membercenter-edit.html',
  'https://membercenter.made-in-china.com/productmanage/product/edit?prodId=8823910',
)
assert(membercenter.product.product.name === 'Stainless Steel Ball Valve DN50 MIC Editor', '10 title')
assert(/Ball Valves/.test(membercenter.product.product.category || ''), '10 category')
assert(membercenter.product.debug.selectorHits.title, '10 title hit')
assert(membercenter.product.debug.selectorHits.category, '10 category hit')
assert(membercenter.window.ASD.productFields.qualityScore(membercenter.fields, membercenter.product) > 60, '10 score')

const noRoot = extract('07-no-product-root.html', 'https://sample.made-in-china.com/help.html')
assert(!noRoot.product.debug.productRootFound, '07 productRootFound must be false')
assert(noRoot.product.debug.degraded, '07 degraded')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    samples: {
      '01': { name: mic.product.product.name, keywords: mic.product.product.keywords, oldKw: mic.fields.keywords },
      '02': { name: vemic.product.product.name, keywords: vemic.product.product.keywords },
      '03': { complete: list.product.debug.completeProduct, name: list.product.product.name },
      '06': { loginRequired: hiddenPw.loginRequired },
      '07': { productRootFound: noRoot.product.debug.productRootFound },
    },
  }),
)
