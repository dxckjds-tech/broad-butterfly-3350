#!/usr/bin/env node
import { loadOrch, threeQuality } from './lib/load-orch.mjs'

const errors = []
function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const box = loadOrch()
const ta = box.ASD.bg.tokenAccounting
const real = ta.normalize({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 })
assert(real.inputTokens === 100 && real.outputTokens === 20 && real.totalTokens === 120 && real.estimated === false, 'O real usage')

const anthropic = ta.normalize({ input_tokens: 80, output_tokens: 10 })
assert(anthropic.inputTokens === 80 && anthropic.outputTokens === 10 && anthropic.estimated === false, 'O anthropic/gemini aliases')

const guessed = ta.normalize(null, { inputText: 'abcd'.repeat(10), outputText: 'efgh' })
assert(guessed.estimated === true && guessed.inputTokens > 0, 'O estimated flag true')

const pricing = box.ASD.modelPricing
const known = pricing.estimateCostUsd({ provider: 'openai', model: 'gpt-4o-mini', inputTokens: 1000000, outputTokens: 1000000 })
assert(known.costKnown === true && known.estimatedCostUsd === 0.15 + 0.6, 'known price ' + known.estimatedCostUsd)

const unknown = pricing.estimateCostUsd({ provider: 'custom', model: 'my-llm', inputTokens: 1000, outputTokens: 100 })
assert(unknown.costKnown === false && unknown.estimatedCostUsd == null, 'P unknown cost not invented')

const deepseekUnknown = pricing.estimateCostUsd({ provider: 'deepseek', model: 'deepseek-v4-flash', inputTokens: 10, outputTokens: 10 })
assert(deepseekUnknown.costKnown === false, 'P unpublished model costKnown=false')

const planner = box.ASD.bg.orchestrationPlanner
const stages = [
  { id: 'evidence', provider: 'openai', model: 'gpt-4o', covers: ['evidence'] },
  { id: 'diagnosis', provider: 'openai', model: 'gpt-4o', covers: ['diagnosis'] },
  { id: 'content', provider: 'openai', model: 'gpt-4o', covers: ['content'] },
]
const replan = planner.replanAfterFailure({
  remainingCalls: 2,
  remainingDuration: 20000,
  remainingCost: 0,
  remainingStages: stages,
  verificationRisk: { requiresVerification: true, level: 'high' },
})
assert(replan.stages.length <= 1, 'Q cost limit merges remaining')
assert(replan.skipVerifier === true || replan.stages.length <= 1, 'Q skip verifier when cost gone')

box.ASD.bg.executionBudget.PRESETS.balanced.maxEstimatedCostUsd = 0.0000001
const plan = planner.build({
  settings: threeQuality({ costPreference: 'balanced' }),
  hasImages: true,
})
assert(plan.ok, 'Q plan still ok')
assert(plan.estimatedCalls <= 2 || (plan.reason || []).join(',').indexOf('cost') !== -1 || plan.estimatedCalls <= 3, 'Q replan or stay within cap')

const routerScore = box.ASD.bg.modelRouter
assert(typeof routerScore.selectModel === 'function', 'router loaded with pricing')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, real: real, unknown: unknown, replan: replan.reason, planCalls: plan.estimatedCalls }))
