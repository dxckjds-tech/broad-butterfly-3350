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
vm.runInContext(fs.readFileSync(path.join(root, 'shared/health-score.js'), 'utf8'), sandbox)
const compute = sandbox.ASD.healthScore.compute

function excellent() {
  return {
    bundle: {
      product: {
        name: 'Industrial Ball Valve DN50',
        category: 'Valves',
        model: 'DN50',
        brand: 'Acme',
        sku: 'BV-DN50',
        keywords: ['industrial ball valve', 'dn50 valve', 'pipeline valve'],
        price: 'USD 28',
        moq: '50 pcs',
        specifications: [
          { name: 'Size', value: 'DN50' },
          { name: 'Material', value: 'Stainless Steel' },
          { name: 'Pressure', value: 'PN16' },
        ],
        material: 'Stainless Steel',
        size: 'DN50',
        power: null,
        voltage: null,
        capacity: null,
        applications: ['industrial pipeline'],
        certifications: ['CE'],
        packaging: 'carton',
        deliveryTime: '15 days',
      },
      company: { name: 'Acme Valves', profile: 'ISO factory' },
      current: {
        title: 'DN50 Stainless Steel Ball Valve for Industrial Pipeline',
        keywords: ['industrial ball valve', 'dn50 valve', 'pipeline valve'],
        description:
          'This DN50 stainless steel ball valve is used for industrial pipeline systems. Size DN50, PN16, carton packing, MOQ 50 pcs.',
      },
    },
    report: {
      summary: { identity: 'Industrial Ball Valve DN50', conflicts: [] },
      facts: [
        { label: 'Size', value: 'DN50', status: 'VERIFIED' },
        { label: 'Material', value: 'Stainless Steel', status: 'VERIFIED' },
        { label: 'MOQ', value: '50 pcs', status: 'VERIFIED' },
      ],
      keywords: { current: ['industrial ball valve'], blocked: [] },
      content: {
        faq: [
          { question: 'What size?', answer: 'DN50' },
          { question: 'What material?', answer: 'Stainless Steel' },
          { question: 'MOQ?', answer: '50 pcs' },
        ],
        geo: {
          headline: 'DN50 ball valve',
          directAnswer: 'Industrial ball valve DN50',
          productFacts: ['DN50', 'Stainless Steel'],
          buyerQuestions: [{ question: 'Size?', answer: 'DN50' }],
        },
      },
      debug: { warnings: [] },
    },
  }
}

function thin() {
  return {
    bundle: {
      product: {
        name: 'Ball Valve',
        category: null,
        model: null,
        brand: null,
        sku: null,
        keywords: ['ball valve', 'valve'],
        price: null,
        moq: null,
        specifications: [],
        applications: [],
        certifications: [],
      },
      company: { name: null, profile: null },
      current: {
        title: 'Industrial Ball Valve DN50',
        keywords: ['ball valve', 'dn50 valve'],
        description: 'A compact ball valve for general use in small workshops and home water lines.',
      },
    },
    report: {
      summary: { identity: 'Ball Valve', conflicts: [] },
      facts: [],
      keywords: { blocked: [] },
      content: { faq: [], geo: {} },
      debug: { warnings: [] },
    },
  }
}

function blank() {
  return {
    bundle: {
      product: {},
      company: {},
      current: { title: null, keywords: [], description: null },
    },
    report: {},
  }
}

function marketing() {
  return {
    bundle: {
      product: {
        name: 'Valve',
        keywords: ['best valve', 'high quality valve', 'hot sale'],
        specifications: [],
      },
      current: {
        title: 'High Quality Best Hot Sale Professional Valve High Quality Valve',
        keywords: ['best valve', 'high quality valve', 'hot sale'],
        description: 'Best professional hot sale high quality valve. Super amazing top rank product.',
      },
    },
    report: {
      summary: { identity: 'Valve', conflicts: ['标题含无证据营销词'] },
      facts: [],
      keywords: { blocked: [{ keyword: 'best valve', reason: '营销词' }] },
      content: { faq: [], geo: {} },
      debug: { warnings: ['缺乏证据的营销描述'] },
    },
  }
}

function verifiedRich() {
  const base = excellent()
  return base
}

function verifiedPoorCousin() {
  const item = excellent()
  item.bundle.product.specifications = []
  item.bundle.product.material = null
  item.bundle.product.certifications = []
  item.bundle.product.packaging = null
  item.bundle.product.deliveryTime = null
  item.bundle.product.moq = null
  item.bundle.product.applications = []
  item.bundle.company = { name: null, profile: null }
  item.report.facts = []
  item.report.content = { faq: [], geo: {} }
  return item
}

const A = compute(excellent().bundle, excellent().report)
const B = compute(thin().bundle, thin().report)
const C = compute(blank().bundle, blank().report)
const D = compute(marketing().bundle, marketing().report)
const E1 = compute(verifiedRich().bundle, verifiedRich().report)
const E2 = compute(verifiedPoorCousin().bundle, verifiedPoorCousin().report)

assert(A.scoreVersion === '1.0', 'scoreVersion')
assert(A.total >= 85, 'A expected >=85, got ' + A.total)
assert(B.total >= 40 && B.total <= 70, 'B expected 40-70, got ' + B.total)
assert(C.total <= 40, 'C expected <=40, got ' + C.total)
assert(D.total < 75, 'D marketing must not be high, got ' + D.total)
assert(D.total < A.total, 'D must be below A')
assert(E1.total > E2.total + 8, 'E verified complete must beat sparse cousin: ' + E1.total + ' vs ' + E2.total)
assert(A.dimensions.length === 6, '6 dimensions')
assert(A.topIssues.length <= 3 && A.topActions.length <= 3, 'top 3 cap')

const first = JSON.stringify(A)
for (let i = 0; i < 20; i += 1) {
  const again = compute(excellent().bundle, excellent().report)
  assert(JSON.stringify(again) === first, 'stability fail at ' + i)
}

assert(!('healthScore' in A) || A.total !== 99, 'must not read AI healthScore')
const spoof = excellent()
spoof.report.healthScore = 99
spoof.report.qualityScore = 1
const spoofed = compute(spoof.bundle, spoof.report)
assert(spoofed.total === A.total, 'AI score field must not change total')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, scores: { A: A.total, B: B.total, C: C.total, D: D.total, E1: E1.total, E2: E2.total } }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    scores: { A: A.total, B: B.total, C: C.total, D: D.total, E1: E1.total, E2: E2.total },
    levelA: A.level,
    stability: 20,
  }),
)
