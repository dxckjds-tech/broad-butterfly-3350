#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadContentScripts, mockChrome } from './lib/load-content.mjs'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = fs.readFileSync(path.join(root, 'tests/fixtures/09-logo-first.html'), 'utf8')
const dom = new JSDOM(html, {
  url: 'https://sample.made-in-china.com/product/valve.html',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
})
mockChrome(dom.window)
loadContentScripts(dom.window, root)
const product = dom.window.ASD.content.extractors.extractAll()
const top = product.images
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}
assert(top.length >= 1, 'no images')
assert(/ball-valve-dn50\.jpg/.test(top[0].src), 'top1 not product: ' + (top[0] && top[0].src))
assert(top.slice(0, 3).every(function (img) {
  return !/logo|avatar|icon/.test((img.src + img.className + img.alt).toLowerCase()) || /ball-valve/.test(img.src)
}), 'logo/avatar in top3')
assert(top[0].score > (top.find((x) => /logo/.test(x.src)) || { score: -999 }).score, 'product score vs logo')
const deduped = top.filter((img) => /ball-valve-dn50/.test(img.src))
assert(deduped.length === 1, 'resize variants not deduped: ' + deduped.length)
assert(dom.window.ASD.constants.isSupportedHost('made-in-china.com'), 'apex host')
assert(dom.window.ASD.constants.isSupportedHost('img.made-in-china.com'), 'subdomain host')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, top: top.map((i) => ({ src: i.src, score: i.score })) }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, top8: top.map((i) => ({ src: i.src, score: i.score, reasons: i.reasons })) }))
