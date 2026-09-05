#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const sandbox = { ASD: {}, console }
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(fs.readFileSync(path.join(root, 'shared/diff.js'), 'utf8'), sandbox)
const diff = sandbox.ASD.diff

const add = diff.titleDiff('Ball Valve', 'DN50 Ball Valve')
assert(add.added.indexOf('DN50') !== -1 && add.removed.length === 0, 'title add')

const del = diff.titleDiff('High Quality Ball Valve', 'Ball Valve')
assert(del.removed.indexOf('High') !== -1 && del.removed.indexOf('Quality') !== -1, 'title delete')

const same = diff.titleDiff('Ball Valve', 'Ball Valve')
assert(same.unchanged && same.added.length === 0 && same.removed.length === 0, 'title same')

const kwAdd = diff.keywordDiff(['Ball Valve'], ['Ball Valve', 'Industrial Ball Valve'], [])
assert(kwAdd.kept.indexOf('Ball Valve') !== -1 && kwAdd.added.indexOf('Industrial Ball Valve') !== -1, 'kw add')

const kwDel = diff.keywordDiff(['Ball Valve', 'Best Valve'], ['Ball Valve'], [{ keyword: 'Best Valve' }])
assert(kwDel.removed.indexOf('Best Valve') !== -1 && kwDel.blocked[0] === 'Best Valve', 'kw delete')

const kwSame = diff.keywordDiff(['Ball Valve'], ['Ball Valve'], [])
assert(kwSame.unchanged, 'kw same')

const detail = diff.detailDiff('Overview one.\n\nSpecs here.', {
  overview: 'Better overview',
  specifications: [{ name: 'Size', value: 'DN50' }],
  applications: ['pipeline'],
})
assert(detail.current.length === 2, 'detail current paragraphs')
assert(detail.suggested.some(function (s) { return s.heading === 'Product Overview' }), 'detail overview section')
assert(detail.suggested.some(function (s) { return /DN50/.test(s.text) }), 'detail spec section')

const emptyCur = diff.detailDiff('', { overview: 'New' })
assert(emptyCur.emptyCurrent && !emptyCur.emptySuggested, 'empty current')

const emptyAi = diff.detailDiff('Has text', {})
assert(!emptyAi.emptyCurrent && emptyAi.emptySuggested, 'empty AI')

const html = diff.titleDiff('<b>Valve</b>', '<b>Valve</b> DN50')
assert(html.current === '<b>Valve</b>', 'html treated as text')
assert(html.added.indexOf('DN50') !== -1, 'html add token')

const special = diff.titleDiff('Valve & Co', 'Valve & Co DN50')
assert(special.added.indexOf('DN50') !== -1, 'special char keep')

const reasons = diff.titleReasons(
  'High Quality Ball Valve',
  'DN50 Stainless Steel Ball Valve',
  { product: { material: 'Stainless Steel', model: 'DN50' } },
  {
    facts: [{ label: 'Size', value: 'DN50', status: 'VERIFIED' }],
    keywords: { blocked: [{ keyword: 'High' }] },
    debug: { warnings: [] },
  },
)
assert(reasons.some(function (r) { return /DN50/.test(r) }), 'reason DN50')
assert(reasons.some(function (r) { return /Stainless/.test(r) }), 'reason material')
const bad = diff.titleReasons('Valve', 'Titanium Magic Valve', { product: { name: 'Valve' } }, { facts: [] })
assert(!bad.some(function (r) { return /Titanium/.test(r) }), 'must not invent Titanium')

const inferredReasons = diff.titleReasons(
  'DN50 Ball Valve',
  'DN50 Stainless Steel Ball Valve',
  { product: { material: null } },
  { facts: [{ label: 'Material', value: 'Stainless Steel', status: 'INFERRED' }] },
)
assert(
  !inferredReasons.some(function (r) {
    return /增加Stainless|增加Steel/.test(r)
  }),
  'INFERRED fact must not form add reason: ' + JSON.stringify(inferredReasons),
)
assert(
  !inferredReasons.some(function (r) {
    return /Stainless|Steel/.test(r)
  }),
  'INFERRED fact must not appear in title reasons: ' + JSON.stringify(inferredReasons),
)

const verifiedReasons = diff.titleReasons(
  'DN50 Ball Valve',
  'DN50 Stainless Steel Ball Valve',
  { product: { material: null } },
  { facts: [{ label: 'Material', value: 'Stainless Steel', status: 'VERIFIED' }] },
)
assert(
  verifiedReasons.some(function (r) {
    return /增加Stainless|增加Steel/.test(r)
  }),
  'VERIFIED fact may form add reason: ' + JSON.stringify(verifiedReasons),
)

const pageFieldReasons = diff.titleReasons(
  'DN50 Ball Valve',
  'DN50 Stainless Steel Ball Valve',
  { product: { material: 'Stainless Steel' } },
  { facts: [] },
)
assert(
  pageFieldReasons.some(function (r) {
    return /增加Stainless|增加Steel/.test(r)
  }),
  'page material field is evidence: ' + JSON.stringify(pageFieldReasons),
)

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, titleAdd: add.added, kwKept: kwAdd.kept, reasons: reasons }))
