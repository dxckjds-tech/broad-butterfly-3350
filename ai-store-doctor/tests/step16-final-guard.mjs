#!/usr/bin/env node
import { loadOrch, threeQuality, product, report, highRiskDiagnosis, emptyEvidence } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const box = loadOrch()
const guard = box.ASD.bg.finalReportGuard

const F = guard.apply(
  {
    facts: [{ label: 'Material', value: 'Stainless Steel', status: 'VERIFIED', sourceType: 'vision', sourceRef: 'img', sourceStage: 'evidence' }],
    content: {
      titles: [{ text: 'Stainless Steel Valve' }],
      detail: { headline: 'x', overview: '', highlights: [], specifications: [{ name: 'Material', value: 'Stainless Steel' }], applications: [], packagingDelivery: '', buyerNote: '' },
      faq: [],
      geo: { headline: '', directAnswer: '', productFacts: ['Stainless Steel'], companyContext: '', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: [] },
    },
    debug: {},
  },
  { rejectedClaims: [] },
)
assert(F.result.facts[0].status === 'OBSERVED', 'F guard vision VERIFIED → OBSERVED')
assert(F.result.facts[0].sourceType === 'vision', 'S sourceType unchanged')
assert(F.result.facts[0].sourceRef === 'img', 'S sourceRef unchanged')
assert(F.result.facts[0].sourceStage === 'evidence', 'S sourceStage unchanged')

const L = guard.apply(
  {
    facts: [{ label: 'Voltage', value: '220V', status: 'UNKNOWN', sourceType: 'model' }],
    content: {
      titles: [{ text: '220V Pump' }],
      detail: { headline: '', overview: '', highlights: [], specifications: [{ name: 'Voltage', value: '220V' }], applications: [], packagingDelivery: '', buyerNote: '' },
      faq: [],
      geo: { headline: '', directAnswer: '', productFacts: ['220V'], companyContext: '', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: [] },
    },
    debug: {},
  },
  { rejectedClaims: [] },
)
assert(
  !(L.result.content.detail.specifications || []).some(function (item) { return item.value === '220V' }),
  'L UNKNOWN not in specifications',
)
assert(
  !(L.result.content.titles || []).some(function (item) { return String(item.text || item).indexOf('220V') !== -1 }),
  'L UNKNOWN not in title',
)

const K = guard.apply(
  {
    facts: [],
    content: {
      titles: [{ text: 'Stainless Steel 1500W Valve' }],
      detail: { headline: 'Stainless Steel', overview: 'Made of Stainless Steel', highlights: ['Stainless Steel'], specifications: [{ name: 'Material', value: 'Stainless Steel' }], applications: [], packagingDelivery: '', buyerNote: '' },
      faq: [{ q: 'Material?', a: 'Stainless Steel' }],
      geo: { headline: 'Stainless Steel', directAnswer: 'Stainless Steel', productFacts: ['Stainless Steel'], companyContext: '', buyerQuestions: [], sourcingGuidance: [], evidenceBasis: [] },
    },
    debug: {},
  },
  { rejectedClaims: [{ value: 'Stainless Steel' }] },
)
const kblob = JSON.stringify(K.result.content)
assert(kblob.indexOf('Stainless Steel') === -1, 'K rejected value scrubbed from title/detail/FAQ/GEO')

const Rbox = loadOrch()
const R = await Rbox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'balanced' }),
  executeFn: async function (opts) {
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis() }
    if (opts.task === 'raw_json' || opts.task === 'content_generation') {
      const error = new Error('content boom')
      error.code = 'PROVIDER_ERROR'
      throw error
    }
    if (opts.task === 'fact_verification') {
      return { result: { decisions: [{ claimId: Rbox.ASD.orchestrationSchemas.claimIdentity({ field: 'power', value: '1500W', sourceType: 'vision', sourceRef: 'img' }), decision: 'downgrade', toStatus: 'UNKNOWN', reasonCode: 'x', explanation: 'y' }] } }
    }
    return { result: report() }
  },
})
assert(R.orchestration.completion && R.orchestration.completion.status === 'partial', 'R partial when content fails: ' + JSON.stringify(R.orchestration.completion))
assert(R.result && R.result.facts && R.result.facts.length, 'R still returns diagnosis facts')
assert(Rbox.ASD.schema.normalizeAndValidate(R.result).ok, 'R final schema ok')

const hist = await box.ASD.sidepanel.historyStore.put({
  productName: 'Valve',
  report: report(),
  product: product(),
  orchestration: {
    mode: 'multi',
    totalCalls: 4,
    totalDurationMs: 18600,
    fallbackUsed: true,
    riskScore: 70,
    verification: { triggered: true, confirmed: 1, downgraded: 2, rejected: 1, raw: { secret: 'nope' }, prompt: 'FULL' },
    usage: { inputTokens: 100, outputTokens: 20 },
    cost: { estimatedCostUsd: 0.01, costKnown: true },
    prompt: 'FULL PROMPT',
    messages: [{ role: 'user', content: 'x' }],
    raw: { secret: 'nope' },
  },
})
const dumped = JSON.stringify(hist)
assert(dumped.indexOf('FULL PROMPT') === -1 && dumped.indexOf('nope') === -1, 'history strips raw/prompt')
assert(hist.orchestration.totalCalls === 4 && hist.orchestration.verificationTriggered === true, 'history keeps counts')
assert(hist.orchestration.downgraded === 2 && hist.orchestration.rejected === 1, 'history verify counts')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, F: F.result.facts[0].status, L: L.result.content.detail.specifications, R: R.orchestration.completion, hist: hist.orchestration }))
