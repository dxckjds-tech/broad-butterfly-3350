#!/usr/bin/env node
import { loadOrch, threeQuality, product, report, highRiskDiagnosis, emptyEvidence, settings } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

function usage(inputTokens, outputTokens) {
  return { prompt_tokens: inputTokens, completion_tokens: outputTokens, inputTokens: inputTokens, outputTokens: outputTokens }
}

const box = loadOrch()
const schemas = box.ASD.orchestrationSchemas
const identity = schemas.claimIdentity

const costBudget = box.ASD.bg.executionBudget.create({ mode: 'balanced', maxEstimatedCostUsd: 0.01 })
costBudget.consumeCall()
costBudget.addUsage(usage(1000, 1000), { estimatedCostUsd: 0.012, costKnown: true })
assert(costBudget.costExceeded === true, 'A unit costExceeded')
assert(costBudget.exhaustedReason === 'COST_BUDGET_EXCEEDED', 'A unit exhaustedReason')
assert(costBudget.canCall() === false, 'A unit canCall false after cost')

const inBudget = box.ASD.bg.executionBudget.create({ mode: 'balanced', maxInputTokens: 100 })
inBudget.consumeCall()
inBudget.addUsage(usage(150, 10), { estimatedCostUsd: 0, costKnown: true })
assert(inBudget.tokenExceeded === true && inBudget.exhaustedReason === 'TOKEN_INPUT_BUDGET_EXCEEDED', 'B unit input token mark')
assert(inBudget.canCall() === false, 'B unit canCall false after input tokens')

const outBudget = box.ASD.bg.executionBudget.create({ mode: 'balanced', maxOutputTokens: 50 })
outBudget.consumeCall()
outBudget.addUsage(usage(10, 80), { estimatedCostUsd: 0, costKnown: true })
assert(outBudget.tokenExceeded === true && outBudget.exhaustedReason === 'TOKEN_OUTPUT_BUDGET_EXCEEDED', 'C unit output token mark')
assert(outBudget.canCall() === false, 'C unit canCall false after output tokens')

const capBudget = box.ASD.bg.executionBudget.create({ mode: 'balanced', maxOutputTokens: 500 })
capBudget.consumeCall()
capBudget.addUsage(usage(10, 200), { estimatedCostUsd: 0, costKnown: true })
assert(capBudget.requestMaxTokens(4200) === 300, 'D unit requestMaxTokens=300 got ' + capBudget.requestMaxTokens(4200))
assert(capBudget.requestMaxTokens(4200) <= capBudget.remainingOutputTokens(), 'D unit maxTokens <= remaining')

const Abox = loadOrch()
const Aorig = Abox.ASD.bg.orchestrationPlanner.replanAfterFailure.bind(Abox.ASD.bg.orchestrationPlanner)
let AplanCalls = 0
Abox.ASD.bg.orchestrationPlanner.replanAfterFailure = function (ctx) {
  AplanCalls += 1
  return Aorig(ctx)
}
const Acalls = []
const A = await Abox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'balanced' }),
  preferences: { costPreference: 'balanced', maxEstimatedCostUsd: 0.01 },
  executeFn: async function (opts) {
    Acalls.push(opts.task)
    if (opts.task === 'evidence_analysis') {
      return { result: emptyEvidence(), usage: usage(40000, 20000) }
    }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis() }
    if (opts.task === 'fact_verification') throw new Error('verifier-blocked-after-cost')
    return { result: report() }
  },
})
assert(Acalls.length === 1 && Acalls[0] === 'evidence_analysis', 'A current response kept, later stages blocked: ' + Acalls.join(','))
assert(Acalls.indexOf('diagnosis_reasoning') === -1, 'A no stage2')
assert(Acalls.indexOf('raw_json') === -1 && Acalls.indexOf('content_generation') === -1 && Acalls.indexOf('product_diagnosis') === -1, 'A no stage3')
assert(Acalls.indexOf('fact_verification') === -1, 'A no verifier')
assert(A.orchestration && A.orchestration.budget && A.orchestration.budget.costExceeded === true, 'A snapshot costExceeded')
assert(A.orchestration.completion && A.orchestration.completion.status === 'partial', 'A completion partial')
assert(AplanCalls >= 1, 'F production replanAfterFailure called, got ' + AplanCalls)
const Apartial = (A.orchestration.replans || []).some(function (row) { return row.action === 'partial' })
assert(Apartial, 'F replan action=partial recorded: ' + JSON.stringify(A.orchestration.replans))
assert((A.orchestration.replans || []).every(function (row) {
  return row && row.trigger != null && row.action != null && !JSON.stringify(row).includes('apiKey')
}), 'F replan debug has no secrets')

const Bbox = loadOrch()
const Bcalls = []
const B = await Bbox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'balanced' }),
  preferences: { costPreference: 'balanced', maxInputTokens: 100 },
  executeFn: async function (opts) {
    Bcalls.push(opts.task)
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence(), usage: usage(150, 10) }
    if (opts.task === 'diagnosis_reasoning') throw new Error('B-diagnosis-should-not-run')
    if (opts.task === 'fact_verification') throw new Error('B-verifier-should-not-run')
    return { result: report() }
  },
})
assert(Bcalls.length === 1, 'B later calls blocked after input tokens: ' + Bcalls.join(','))
assert(B.orchestration.budget && B.orchestration.budget.tokenExceeded === true, 'B tokenExceeded')
assert(B.orchestration.budget.exhaustedReason === 'TOKEN_INPUT_BUDGET_EXCEEDED', 'B input reason: ' + (B.orchestration.budget && B.orchestration.budget.exhaustedReason))

const Cbox = loadOrch()
const Ccalls = []
const C = await Cbox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'balanced' }),
  preferences: { costPreference: 'balanced', maxOutputTokens: 50 },
  executeFn: async function (opts) {
    Ccalls.push(opts.task)
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence(), usage: usage(10, 80) }
    if (opts.task === 'diagnosis_reasoning') throw new Error('C-diagnosis-should-not-run')
    if (opts.task === 'fact_verification') throw new Error('C-verifier-should-not-run')
    return { result: report() }
  },
})
assert(Ccalls.length === 1, 'C later calls blocked after output tokens: ' + Ccalls.join(','))
assert(C.orchestration.budget && C.orchestration.budget.tokenExceeded === true, 'C tokenExceeded')
assert(C.orchestration.budget.exhaustedReason === 'TOKEN_OUTPUT_BUDGET_EXCEEDED', 'C output reason: ' + (C.orchestration.budget && C.orchestration.budget.exhaustedReason))

const Dbox = loadOrch()
const Dtokens = []
const D = await Dbox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'balanced' }),
  preferences: { costPreference: 'balanced', maxOutputTokens: 500 },
  executeFn: async function (opts) {
    Dtokens.push({ task: opts.task, maxTokens: opts.maxTokens })
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence(), usage: usage(10, 200) }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis(), usage: usage(10, 10) }
    if (opts.task === 'fact_verification') {
      return {
        result: {
          decisions: [
            { claimId: identity({ field: 'power', value: '1500W', sourceType: 'vision', sourceRef: 'img' }), decision: 'downgrade', toStatus: 'UNKNOWN', reasonCode: 'x', explanation: 'y' },
          ],
        },
      }
    }
    return { result: report(), usage: usage(10, 10) }
  },
})
const Dsecond = Dtokens[1]
assert(Dtokens[0] && Dtokens[0].maxTokens <= 500, 'D first maxTokens capped')
assert(Dsecond && Dsecond.maxTokens <= 300, 'D later maxTokens <= remainingOutput 300, got ' + (Dsecond && Dsecond.maxTokens))
assert(D.orchestration && D.orchestration.totalCalls >= 2, 'D continued after first call')

const Ebox = loadOrch()
const Eorig = Ebox.ASD.bg.orchestrationPlanner.replanAfterFailure.bind(Ebox.ASD.bg.orchestrationPlanner)
let EplanCalls = 0
Ebox.ASD.bg.orchestrationPlanner.replanAfterFailure = function (ctx) {
  EplanCalls += 1
  return Eorig(ctx)
}
const Etasks = []
const E = await Ebox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product(),
  fields: { title: 'x', images: [] },
  settings: settings(
    {
      deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' },
      openai: { model: 'gpt-4o-mini', apiKey: 'o' },
    },
    { orchestrationMode: 'multi' },
  ),
  executeFn: async function (opts) {
    Etasks.push(opts.task + ':' + opts.provider)
    if (Etasks.length === 1) {
      const error = new Error('net')
      error.code = 'NETWORK_ERROR'
      throw error
    }
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    return { result: report() }
  },
})
assert(EplanCalls >= 1, 'E production replanAfterFailure after failover, calls=' + EplanCalls)
assert((E.orchestration.replans || []).some(function (row) { return row.trigger === 'FALLBACK_USED' }), 'E debug replans trigger FALLBACK_USED: ' + JSON.stringify(E.orchestration.replans))
assert(Etasks.length >= 2, 'E failover still executed')

const ce = { field: 'certification', label: 'Certification', value: 'CE', sourceType: 'spec_table', sourceRef: 'cert-ce', status: 'VERIFIED' }
const ul = { field: 'certification', label: 'Certification', value: 'UL', sourceType: 'vision', sourceRef: 'image-2', status: 'OBSERVED' }
const ceId = identity(ce)
const ulId = identity(ul)
assert(ceId !== ulId, 'G distinct certification claimIds')
const multi = schemas.applyVerifierDecisions(
  { facts: [Object.assign({ claimId: ceId }, ce), Object.assign({ claimId: ulId }, ul)] },
  { decisions: [{ claimId: ulId, decision: 'reject', toStatus: 'UNKNOWN', reasonCode: 'no', explanation: 'ul only' }] },
)
assert(multi.counts.rejected === 1, 'G rejected only one')
assert(multi.diagnosis.facts.length === 1 && multi.diagnosis.facts[0].value === 'CE', 'G CE kept UL removed')
assert(multi.diagnosis.facts[0].claimId === ceId, 'G remaining claim is CE identity')

const pagePower = { field: 'power', value: '1200W', sourceType: 'spec_table', sourceRef: 'power', status: 'VERIFIED' }
const visionPower = { field: 'power', value: '1500W', sourceType: 'vision', sourceRef: 'image-2', status: 'OBSERVED' }
const pageId = identity(pagePower)
const visionId = identity(visionPower)
assert(pageId === 'power|1200w|spec_table|power', 'I page identity ' + pageId)
assert(visionId === 'power|1500w|vision|image-2', 'I vision identity ' + visionId)
const conflictRisk = box.ASD.bg.verificationRisk.assessVerificationRisk({
  productBundle: product('1200W'),
  diagnosis: { identity: { name: 'Valve', confidence: 80 }, facts: [visionPower] },
})
const conflictIds = (conflictRisk.claimsToVerify || []).map(function (item) { return item.claimId })
assert(conflictIds.indexOf(visionId) !== -1, 'I vision claim present')
assert(conflictIds.some(function (id) { return id.indexOf('1200w') !== -1 && id !== visionId }), 'I page claim distinguishable')
const onlyVision = schemas.applyVerifierDecisions(
  { facts: [Object.assign({ claimId: pageId }, pagePower), Object.assign({ claimId: visionId }, visionPower)] },
  { decisions: [{ claimId: visionId, decision: 'reject', toStatus: 'UNKNOWN', reasonCode: 'conflict', explanation: 'drop vision' }] },
)
assert(onlyVision.diagnosis.facts.length === 1 && onlyVision.diagnosis.facts[0].value === '1200W', 'I only target conflict claim rejected')

const sample = { field: 'Power', value: '1500W', sourceType: 'vision', sourceRef: 'image-2' }
const first = identity(sample)
const allSame = []
for (let i = 0; i < 20; i += 1) allSame.push(identity(sample))
assert(allSame.every(function (id) { return id === first && id === 'power|1500w|vision|image-2' }), 'H claimId 20/20 deterministic')
assert(first.indexOf('undefined') === -1 && !/Math.random/.test(String(schemas.claimIdentity)), 'H no random identity')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, A: { calls: Acalls, replans: A.orchestration && A.orchestration.replans, replanCalls: AplanCalls }, B: Bcalls, C: Ccalls, D: Dtokens, E: { tasks: Etasks, replans: E.orchestration && E.orchestration.replans, replanCalls: EplanCalls } }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({
  ok: true,
  A: { calls: Acalls, replans: A.orchestration.replans, replanCalls: AplanCalls },
  B: B.orchestration.budget.exhaustedReason,
  C: C.orchestration.budget.exhaustedReason,
  D: Dtokens.map(function (row) { return row.maxTokens }),
  E: { replanCalls: EplanCalls, replans: E.orchestration.replans },
  G: { ceId: ceId, ulId: ulId },
  H: first,
}))
