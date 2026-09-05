#!/usr/bin/env node
import { loadOrch, threeQuality, product, report, highRiskDiagnosis, emptyEvidence, settings } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const box = loadOrch()
const budget = box.ASD.bg.executionBudget.create({ mode: 'balanced' })
assert(budget.maxCalls === 4, 'balanced maxCalls=4')
assert(budget.reserveVerifier === true, 'balanced reserve verifier')
budget.consumeCall()
budget.consumeCall()
budget.consumeCall()
assert(budget.remainingCalls({ keepVerifier: true }) === 0, '3 stage calls reserve 4th')
budget.consumeCall()
assert(budget.usedCalls === 4, 'A usedCalls=4')
let fifth = ''
try {
  budget.consumeCall()
} catch (error) {
  fifth = error.code
}
assert(fifth === 'BUDGET_EXCEEDED', 'A fifth call blocked: ' + fifth)

const eco = box.ASD.bg.executionBudget.create({ mode: 'economy' })
assert(eco.maxCalls === 2 && eco.reserveVerifier === false, 'economy default 2 / no verifier reserve')
assert(box.ASD.bg.executionBudget.create({ mode: 'quality' }).maxDurationMs === 50000, 'quality duration')
assert(budget.stageTimeout('evidence') <= 15000, 'stage soft timeout')

const calls = []
const A = await box.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality(),
  executeFn: async function (opts) {
    calls.push(opts.task)
    if (calls.length > 4) throw new Error('fifth-call')
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis() }
    if (opts.task === 'fact_verification') {
      return {
        result: {
          decisions: [{ claimId: 'power', decision: 'downgrade', toStatus: 'UNKNOWN', reasonCode: 'conflict', explanation: 'page 1200W' }],
        },
      }
    }
    return { result: report() }
  },
})
assert(calls.length === 4, 'A orchestrator 4 calls got ' + calls.join(','))
assert(A.orchestration.totalCalls === 4, 'A totalCalls=4')
assert(calls[3] === 'fact_verification', 'A 4th is verifier')
assert(calls.indexOf('fifth-call') === -1, 'A no fifth')

const Bbox = loadOrch()
const Bcalls = []
const B = await Bbox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'DN50', images: ['https://img.made-in-china.com/sample/valve.jpg'] },
  requestContext: { hasImages: true },
  settings: threeQuality({ costPreference: 'balanced' }),
  executeFn: async function (opts) {
    Bcalls.push(opts.task)
    if (Bcalls.length === 1) {
      const error = new Error('timeout')
      error.code = 'CONNECTION_ERROR'
      throw error
    }
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis() }
    if (opts.task === 'fact_verification') throw new Error('verifier-should-not-run')
    return { result: report() }
  },
})
assert(Bcalls.length === 4, 'B 4 calls got ' + Bcalls.join(','))
assert(Bcalls.indexOf('fact_verification') === -1, 'B verifier not called after failover budget')
assert(B.orchestration.totalCalls === 4, 'B usedCalls=4')
assert(!B.orchestration.verification || !B.orchestration.verification.triggered, 'B verifier not triggered')

const Mbox = loadOrch()
const Mcals = []
const M = await Mbox.ASD.bg.orchestrator.runProductDiagnosis({
  productBundle: product('1200W'),
  fields: { title: 'x', images: [] },
  settings: settings(
    {
      deepseek: { model: 'deepseek-v4-flash', apiKey: 'ds' },
      openai: { model: 'gpt-4o', apiKey: 'o' },
    },
    { orchestrationMode: 'multi', costPreference: 'economy' },
  ),
  preferences: { costPreference: 'economy', orchestrationMode: 'multi' },
  executeFn: async function (opts) {
    Mcals.push(opts.task)
    if (opts.task === 'fact_verification') throw new Error('economy-verifier')
    if (opts.task === 'evidence_analysis') return { result: emptyEvidence() }
    if (opts.task === 'diagnosis_reasoning') return { result: highRiskDiagnosis() }
    return { result: report({ summary: { identity: 'DN50 Ball Valve', confidence: 40, status: 'UNKNOWN', dataCompleteness: 40, contentReadiness: 20 } }) }
  },
})
assert(Mcals.indexOf('fact_verification') === -1, 'M economy no verifier')
assert(Mcals.length <= 2, 'M economy <=2 got ' + Mcals.length + ' ' + Mcals.join(','))
assert(M.orchestration.totalCalls <= 2, 'M budget <=2')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, A: calls, B: Bcalls, M: Mcals, Aorch: A.orchestration.totalCalls }))
