#!/usr/bin/env node
import { loadOrch } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const box = loadOrch()
const assess = box.ASD.bg.verificationRisk.assessVerificationRisk

const F = assess({
  diagnosis: {
    identity: { name: 'Valve', confidence: 80 },
    facts: [{ field: 'material', label: 'Material', value: 'Stainless Steel', sourceType: 'vision', status: 'VERIFIED' }],
  },
})
assert(F.level === 'high', 'F vision-only VERIFIED material is high, got ' + F.level + ' ' + F.score)
assert(F.requiresVerification === true, 'F requires verifier')
assert(F.reasons.indexOf('vision_only_critical_fact') !== -1 || F.reasons.indexOf('verified_without_trusted_source') !== -1, 'F reasons')

const G = assess({
  diagnosis: {
    identity: { name: 'Valve', confidence: 80 },
    facts: [{ field: 'material', label: 'Material', value: 'Stainless Steel', sourceType: 'spec_table', status: 'VERIFIED' }],
  },
})
assert(G.level !== 'high', 'G trusted spec_table is not high, got ' + G.level + ' ' + G.score)

const H = assess({
  productBundle: { product: { specifications: [{ name: 'Power', value: '1200W' }], power: '1200W' } },
  diagnosis: {
    identity: { name: 'Valve', confidence: 80 },
    facts: [{ field: 'power', label: 'Power', value: '1500W', sourceType: 'vision', status: 'OBSERVED' }],
  },
})
assert(H.level === 'high', 'H 1200 vs 1500 is high, got ' + H.level + ' ' + H.score)
assert(H.reasons.indexOf('fact_conflict') !== -1, 'H conflict reason')

const low = assess({
  diagnosis: {
    identity: { name: 'Valve', confidence: 90 },
    facts: [{ field: 'color', value: 'red', sourceType: 'product_field', status: 'VERIFIED' }],
  },
})
assert(low.level === 'low' && low.requiresVerification === false, 'low identity+trusted not verify')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, F: F, G: G, H: H, low: low.score }))
