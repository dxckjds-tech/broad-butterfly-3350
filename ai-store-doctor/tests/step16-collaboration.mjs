#!/usr/bin/env node
import { loadOrch, settings, product, highRiskDiagnosis } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const sandbox = loadOrch()
const ASD = sandbox.ASD

const one = settings({ openai: { model: 'gpt-4o', apiKey: 'o' } }, { collaborationMode: 'single', singleModel: { provider: 'openai', model: 'gpt-4o' } })
const caseA = ASD.bg.collaborationScheduler.assignRoles({ settings: one, hasImages: false, collaborationMode: 'single' })
assert(caseA.ok, 'case A ok: ' + (caseA.reason || []).join(','))
assert(caseA.assignments.evidence.provider === 'openai', 'A evidence openai')
assert(caseA.assignments.reasoning.provider === 'openai', 'A reasoning openai')
assert(caseA.assignments.content.provider === 'openai', 'A content openai')
assert(caseA.assignments.verifier.provider === 'openai', 'A verifier openai')

const custom = settings(
  {
    moonshot: { model: 'kimi-k2.5', apiKey: 'k' },
    deepseek: { model: 'deepseek-v4-flash', apiKey: 'd' },
  },
  {
    collaborationMode: 'custom',
    roleAssignments: {
      evidence: { mode: 'fixed', provider: 'moonshot', model: 'kimi-k2.5' },
      reasoning: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      keywords: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      content: { mode: 'fixed', provider: 'moonshot', model: 'kimi-k2.5' },
      verifier: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
    },
  },
)
const caseB = ASD.bg.collaborationScheduler.build({ settings: custom, hasImages: true, collaborationMode: 'custom' })
assert(caseB.ok, 'case B ok')
assert(caseB.assignments.evidence.provider === 'moonshot' && caseB.assignments.evidence.model === 'kimi-k2.5', 'B evidence kimi')
assert(caseB.assignments.reasoning.provider === 'deepseek', 'B reasoning deepseek')
assert(caseB.assignments.keywords.provider === 'deepseek', 'B keywords deepseek')
assert(caseB.assignments.content.provider === 'moonshot', 'B content kimi')
assert(caseB.assignments.verifier.provider === 'deepseek', 'B verifier deepseek')
assert((caseB.mergedRoles || []).some(function (item) { return /reasoning/.test(item) && /keywords/.test(item) }) || caseB.stages.some(function (s) { return (s.roles || []).indexOf('reasoning') !== -1 && (s.roles || []).indexOf('keywords') !== -1 }), 'case E merge reasoning+keywords')

const hybrid = settings(
  {
    moonshot: { model: 'kimi-k2.5', apiKey: 'k' },
    deepseek: { model: 'deepseek-v4-flash', apiKey: 'd' },
    openai: { model: 'gpt-4o', apiKey: 'o' },
  },
  {
    collaborationMode: 'hybrid',
    roleAssignments: {
      evidence: { mode: 'fixed', provider: 'moonshot', model: 'kimi-k2.5' },
      reasoning: { mode: 'auto' },
      keywords: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      content: { mode: 'auto' },
      verifier: { mode: 'auto' },
    },
  },
)
const caseC = ASD.bg.collaborationScheduler.build({ settings: hybrid, hasImages: true, collaborationMode: 'hybrid' })
assert(caseC.ok, 'case C ok')
assert(caseC.assignments.evidence.provider === 'moonshot', 'C evidence stays kimi')
assert(caseC.assignments.keywords.provider === 'deepseek', 'C keywords stays deepseek')
assert(caseC.assignments.evidence.assignmentMode === 'fixed', 'C evidence fixed')
assert(caseC.assignments.reasoning.assignmentMode === 'auto', 'C reasoning auto')

const mismatch = settings(
  { deepseek: { model: 'deepseek-v4-flash', apiKey: 'd' } },
  {
    collaborationMode: 'custom',
    roleAssignments: {
      evidence: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      reasoning: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      keywords: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      content: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
      verifier: { mode: 'fixed', provider: 'deepseek', model: 'deepseek-v4-flash' },
    },
  },
)
const caseD = ASD.bg.collaborationScheduler.assignRoles({ settings: mismatch, hasImages: true, collaborationMode: 'custom' })
assert(!caseD.ok, 'case D must not silently swap')
assert(caseD.code === 'ROLE_CAPABILITY_MISMATCH', 'case D code: ' + caseD.code)
assert(/视觉/.test((caseD.reason || []).join('')), 'case D message')
assert(caseD.assignments.evidence.provider === 'deepseek', 'case D still keeps user model')

const fused = ASD.bg.fusionEngine.fuse({
  productBundle: product('1200W'),
  report: {
    facts: [
      { field: 'power', label: 'Power', value: '1500W', status: 'VERIFIED', sourceType: 'vision', confidence: 99 },
      { field: 'power', label: 'Power', value: '1500W', status: 'VERIFIED', sourceType: 'model_inference', confidence: 90 },
    ],
  },
  roles: {
    reasoning: { facts: [{ field: 'power', value: '1500W', sourceType: 'vision' }] },
    evidence: { facts: [{ field: 'power', value: '1500W', sourceType: 'vision' }] },
  },
})
const verifiedPower = fused.result.facts.filter(function (item) { return item.field === 'power' && item.status === 'VERIFIED' })
assert(verifiedPower.length >= 1 && verifiedPower[0].value === '1200W', 'case F page 1200W VERIFIED: ' + JSON.stringify(verifiedPower))
assert(fused.conflicts.some(function (item) { return item.value === '1500W' }), 'case F 1500W conflict/observed')

const recovered = ASD.bg.finalReportGuard.apply({
  facts: [{ field: 'power', value: '1500W', status: 'VERIFIED', sourceType: 'reasoning_recovery', contentSource: 'REASONING_RECOVERY', confidence: 90 }],
})
assert(recovered.result.facts[0].status !== 'VERIFIED', 'case G reasoning recovery cannot stay VERIFIED')

const verify = ASD.orchestrationSchemas.normalizeVerification({
  decisions: [
    { claimId: 'power|1500w|vision|img', decision: 'confirm' },
    { claimId: 'material|ss|vision|img', decision: 'downgrade' },
    { claimId: 'x|y|z|q', decision: 'reject' },
  ],
})
assert(verify.ok, 'verifier schema ok')
assert((verify.result.decisions || []).every(function (d) { return d.decision === 'confirm' || d.decision === 'downgrade' || d.decision === 'reject' }), 'case H only confirm/downgrade/reject')
const verifyBad = ASD.orchestrationSchemas.normalizeVerification({
  decisions: [{ claimId: 'bad|1|2|3', decision: 'rewrite' }],
})
assert(!verifyBad.ok, 'case H rewrite rejected')

const planner = ASD.bg.orchestrationPlanner.build({
  settings: custom,
  hasImages: true,
  collaborationMode: 'custom',
})
assert(planner.ok, 'planner custom ok')
assert(planner.assignments.evidence.provider === 'moonshot', 'planner keeps custom evidence')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(
  JSON.stringify({
    ok: true,
    A: caseA.assignments.evidence.provider,
    B: caseB.assignments.content.provider,
    C: caseC.assignments.evidence.assignmentMode,
    D: caseD.code,
    F: verifiedPower[0] && verifiedPower[0].value,
  }),
)
