#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadContentScripts, mockChrome } from './lib/load-content.mjs'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadSanitize() {
  const sandbox = { globalThis: null, console }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  for (const file of ['shared/pii-patterns.js', 'shared/sanitize.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  }
  return sandbox.ASD.sanitize
}

const sanitize = loadSanitize()
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const raw =
  'Contact sales@example.com 13800138000 sk-abcdefghijklmnopqrstuvwxyz12 11010119900307891X 4111-1111-1111-1111 Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcd keep MT-8800 SKU1380013 13.8V 1200W 220-240V 50/60Hz 1.5L'
const layer2 = sanitize.sanitizePayload({ text: raw, sku: 'SKU1380013', model: 'MT-8800' })
assert(!/sales@example.com/.test(JSON.stringify(layer2)), 'email leaked')
assert(!/13800138000/.test(JSON.stringify(layer2)), 'phone leaked')
assert(!/sk-abcdefghijklmnopqrstuvwxyz12/.test(JSON.stringify(layer2)), 'token leaked')
assert(!/11010119900307891X/.test(JSON.stringify(layer2)), 'id leaked')
assert(!/4111-1111-1111-1111/.test(JSON.stringify(layer2)), 'card leaked')
assert(JSON.stringify(layer2).includes('MT-8800'), 'model killed')
assert(JSON.stringify(layer2).includes('SKU1380013'), 'sku killed')
assert(JSON.stringify(layer2).includes('13.8V'), '13.8V killed')
assert(JSON.stringify(layer2).includes('1200W'), '1200W killed')
assert(JSON.stringify(layer2).includes('220-240V'), '220-240V killed')
assert(JSON.stringify(layer2).includes('50/60Hz'), '50/60Hz killed')
assert(JSON.stringify(layer2).includes('1.5L'), '1.5L killed')
assert(layer2.debug.redacted.email >= 1, 'email count')
assert(layer2.debug.redacted.phone >= 1, 'phone count')
assert(layer2.debug.redacted.secret >= 1, 'secret count')
assert(layer2.debug.redacted.id >= 1, 'id count')
assert(layer2.debug.redacted.card >= 1, 'card count')
assert(!JSON.stringify(layer2.debug).includes('sales@example.com'), 'debug stored raw email')

const html = fs.readFileSync(path.join(root, 'tests/fixtures/08-pii-and-specs.html'), 'utf8')
const dom = new JSDOM(html, {
  url: 'https://sample.made-in-china.com/product/pii.html',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
})
mockChrome(dom.window)
loadContentScripts(dom.window, root)
const collected = dom.window.collectDualTrack()
const blob = JSON.stringify(collected)
assert(!/sales@example.com/.test(blob), 'collected email')
assert(!/13800138000/.test(blob), 'collected phone')
assert(blob.includes('MT-8800'), 'collected model')
assert(blob.includes('SKU1380013'), 'collected sku')
assert(collected.product.debug.redacted.total >= 3, 'redacted total')
assert(collected.product.debug.injectionHits.total >= 1, 'injection hits')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, redacted: layer2.debug.redacted }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    redacted: layer2.debug.redacted,
    injectionHits: collected.product.debug.injectionHits,
    labels: {
      email: blob.includes('[REDACTED_EMAIL]'),
      phone: blob.includes('[REDACTED_PHONE]'),
    },
  }),
)
