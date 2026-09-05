#!/usr/bin/env node
import { loadOrch, threeQuality, product, report, highRiskDiagnosis, emptyEvidence, settings } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const box = loadOrch()
const schemas = box.ASD.orchestrationSchemas

const illegal = schemas.normalizeVerification({
  newFacts: [{ label: 'Secret', value: 'Nope' }],
  decisions: [{ claimId: 'material', decision: 'confirm', toStatus: 'VERIFIED', reasonCode: 'x', explanation: 'y' }],
})
assert(!illegal.ok && (illegal.errors || []).join(',').indexOf('VERIFIER_CANNOT_ADD_FACTS') !== -1, 'I newFacts fail schema')

const ok = schemas.normalizeVerification({
  decisions: [{ claimId: 'material', decision: 'confirm', toStatus: 'VERIFIED', reasonCode: 'ok', explanation: 'looks fine' }],
})
assert(ok.ok && ok.result.decisions[0].decision === 'confirm', 'valid verifier schema')

const applied = schemas.applyVerifierDecisions(
  {
    facts: [{ label: 'Material', field: 'material', value: 'Stainless Steel', status: 'OBSERVED', sourceType: 'vision', sourceRef: 'img1', sourceStage: 'evidence' }],
  },
  { decisions: [{ claimId: 'material', decision: 'confirm', toStatus: 'VERIFIED', reasonCode: 'ok', explanation: 'x' }] },
)
assert(applied.diagnosis.facts[0].status !== 'VERIFIED', 'J confirm+vision still not VERIFIED: ' + applied.diagnosis.facts[0].status)
assert(applied.diagnosis.facts[0].sourceType === 'vision', 'S provenance kept')
assert(applied.diagnosis.facts[0].sourceRef === 'img1', 'S sourceRef kept')

const rejected = schemas.applyVerifierDecisions(
  { facts: [{ label: 'Material', field: 'material', value: 'Stainless Steel', status: 'OBSERVED', sourceType: 'vision' }] },
  { decisions: [{ claimId: 'material', decision: 'reject', toStatus: 'UNKNOWN', reasonCode: 'no', explanation: 'x' }] },
)
assert(rejected.counts.rejected === 1 && rejected.diagnosis.facts.length === 0, 'K reject removes fact')

const Ncalls = []
const N = await box.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'quality' }),
  preferences: { costPreference: 'quality' },
  executeFn: async function (opts) {
    Ncalls.push(opts.task)
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis() }
    if (opts.task === 'fact_verification') {
      const user = (opts.messages || []).filter(function (item) { return item.role === 'user' })[0]
      const userText = typeof (user && user.content) === 'string' ? user.content : JSON.stringify((user && user.content) || {})
      assert(userText.indexOf('"newFacts"') === -1 && userText.indexOf('"suggestedFacts"') === -1, 'verifier user payload has no newFacts')
      return {
        result: {
          decisions: [
            { claimId: 'material', decision: 'reject', toStatus: 'UNKNOWN', reasonCode: 'no', explanation: 'untrusted vision' },
            { claimId: 'power', decision: 'reject', toStatus: 'UNKNOWN', reasonCode: 'conflict', explanation: '1200 vs 1500' },
          ],
        },
      }
    }
    return {
      result: report({
        content: {
          titles: [{ text: '1500W Stainless Steel Valve', style: 'spec', factsUsed: ['Power'], excluded: [] }],
          detail: { headline: '1500W', overview: 'Stainless Steel body', highlights: ['Stainless Steel'], specifications: [{ name: 'Power', value: '1500W' }], applications: [], packagingDelivery: '', buyerNote: '' },
          faq: [{ q: 'Is it Stainless Steel?', a: 'Yes Stainless Steel' }],
          geo: { headline: 'Stainless Steel valve', directAnswer: '1500W', productFacts: ['Stainless Steel'], companyContext: 'Acme', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: [] },
        },
      }),
    }
  },
})
assert(Ncalls.indexOf('fact_verification') !== -1, 'N quality high-risk verifier ran: ' + Ncalls.join(','))
assert(N.orchestration.totalCalls === 4, 'N 4 calls')
assert(N.orchestration.verification && N.orchestration.verification.triggered, 'N triggered')
const material = (N.result.facts || []).find(function (item) { return /material/i.test(item.label || item.field || '') })
if (material) assert(material.status !== 'VERIFIED', 'J final material not VERIFIED')
const blob = JSON.stringify(N.result.content || {})
assert(blob.indexOf('Stainless Steel') === -1, 'K rejected Stainless Steel stripped from content')
assert(blob.indexOf('1500W') === -1, 'K rejected power stripped')

const single = loadOrch()
const Scalls = []
await single.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product(),
  fields: { title: 'x' },
  settings: settings({ deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' } }, { orchestrationMode: 'single' }),
  executeFn: async function (opts) {
    Scalls.push(opts.task)
    return { result: report() }
  },
})
assert(Scalls.length === 1 && Scalls[0] === 'product_diagnosis', 'single mode still one call')
assert(Scalls.indexOf('fact_verification') === -1, 'single does not auto-verify')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, I: illegal.errors, J: material && material.status, N: Ncalls, single: Scalls }))
