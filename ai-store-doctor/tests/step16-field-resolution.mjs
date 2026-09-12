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

function extract(htmlFile, url) {
  const html = fs.readFileSync(path.join(root, 'tests/fixtures', htmlFile), 'utf8')
  const dom = new JSDOM(html, { url: url, pretendToBeVisual: true, runScripts: 'outside-only' })
  mockChrome(dom.window)
  loadContentScripts(dom.window, root)
  const fields = dom.window.extractFields()
  const product = dom.window.ASD.content.extractors.extractAll()
  const score = dom.window.ASD.productFields.qualityScore(fields, product)
  return { fields, product, score, window: dom.window, ASD: dom.window.ASD }
}

const edit = extract('10-mic-membercenter-edit.html', 'https://membercenter.made-in-china.com/productmanage/product/edit?prodId=1')
assert(edit.product.debug.pageProfile === 'mic-membercenter-edit', 'edit profile: ' + edit.product.debug.pageProfile)
assert(edit.product.product.name === 'Stainless Steel Ball Valve DN50 MIC Editor', 'edit title')
assert(/Ball Valves/.test(edit.product.product.category || ''), 'edit category')
assert((edit.product.product.keywords || []).length >= 1, 'edit keywords')
assert(edit.score >= 85, 'edit quality >= 85, got ' + edit.score)
assert(edit.product.debug.selectorHits.productRoot !== 'body', 'edit root not body')
assert(edit.product.fieldProvenance && edit.product.fieldProvenance.productName, 'edit provenance')

const detail = extract('01-mic-product-detail.html', 'https://sample.made-in-china.com/product/canister-vacuum-cleaner-20l.html')
assert(detail.product.debug.pageProfile === 'mic-detail', 'detail profile: ' + detail.product.debug.pageProfile)
assert(detail.product.product.name === 'Canister Vacuum Cleaner 20L', 'detail title')
assert(detail.product.product.keywords.length >= 1, 'detail keywords')
assert(detail.score >= 85, 'detail quality: ' + detail.score)

const list = extract('11-mic-membercenter-list.html', 'https://membercenter.made-in-china.com/productmanage/product/list')
assert(list.product.debug.pageProfile === 'mic-membercenter-list', 'list profile: ' + list.product.debug.pageProfile)
assert(!list.product.debug.completeProduct, 'list must not be complete product')
assert(!list.product.product.name, 'list must not take product name')

const op = extract('12-membercenter-operation-table.html', 'https://membercenter.made-in-china.com/productmanage/product/edit?id=2')
assert(op.product.debug.pageProfile === 'mic-membercenter-edit', 'op profile')
assert(op.product.product.name === 'Operation Table Valve', 'op title')
assert(op.product.debug.completeProduct, 'op edit with 操作 column is not a list')
assert(/1200W/.test(JSON.stringify(op.product.product.specifications)), 'op specs')

const random = extract('13-membercenter-random-input-name.html', 'https://membercenter.made-in-china.com/product/edit')
assert(random.product.product.name === 'Random Name Recovered Pump', 'random label title: ' + random.product.product.name)
assert(/Water Pumps/.test(random.product.product.category || ''), 'random category')
assert((random.product.product.keywords || []).length >= 1, 'random keywords')

const hidden = extract('14-hidden-token-negative.html', 'https://membercenter.made-in-china.com/product/edit')
const blob = JSON.stringify(hidden.product)
assert(blob.indexOf('SECRET_TOKEN_SHOULD_NOT_READ') === -1, 'hidden token leaked')
assert(blob.indexOf('SESSION_ID_SHOULD_NOT_READ') === -1, 'session leaked')
assert(hidden.product.product.name === 'Hidden Token Valve', 'hidden title')
assert(hidden.product.product.categoryMeta && hidden.product.product.categoryMeta.id === '112233', 'cat id whitelist')

const noRoot = extract('07-no-product-root.html', 'https://sample.made-in-china.com/help.html')
assert(!noRoot.product.debug.productRootFound, 'no root')
assert(!noRoot.product.fallbackText, 'no body fallback text')
assert(!(noRoot.fields && noRoot.fields.visibleText), 'legacy path must not send body visibleText when root missing')

const fieldMap = fs.readFileSync(path.join(root, 'content/field-map.js'), 'utf8')
assert(!/__INITIAL_STATE__/.test(fieldMap), 'must not read INITIAL_STATE')
assert(!/"form"/.test(fieldMap) || /form:has/.test(fieldMap), 'bare form fallback removed')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    edit: { score: edit.score, profile: edit.product.debug.pageProfile, keywords: edit.product.product.keywords },
    detail: { score: detail.score, profile: detail.product.debug.pageProfile },
    listComplete: list.product.debug.completeProduct,
    opComplete: op.product.debug.completeProduct,
  }),
)
