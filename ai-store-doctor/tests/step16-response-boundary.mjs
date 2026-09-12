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

function load() {
  const sandbox = { ASD: {}, console: console }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  ;['shared/error-codes.js', 'shared/response-normalize.js', 'shared/capability-learning.js', 'shared/model-capabilities.js', 'background/model-health.js'].forEach(
    function (file) {
      vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
    },
  )
  return sandbox.ASD
}

const ASD = load()
const n = ASD.responseNormalize

const kimiString = n.normalizeResponse({
  choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
})
assert(kimiString.content.indexOf('ok') !== -1, 'kimi string')
assert(kimiString.contentSource === 'MESSAGE_CONTENT', 'string source')

const kimiArray = n.normalizeResponse({
  choices: [{ message: { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] }, finish_reason: 'stop' }],
})
assert(kimiArray.content === '{"a":1}', 'kimi array: ' + kimiArray.content)

const thinkingOnly = n.normalizeResponse({
  choices: [{ message: { content: [{ type: 'thinking', text: '{"ok":true}' }] }, finish_reason: 'stop' }],
})
assert(thinkingOnly.contentSource === 'THINKING_RECOVERY', 'thinking source: ' + thinkingOnly.contentSource)

const emptyStop = n.normalizeResponse({
  choices: [{ message: { content: '' }, finish_reason: 'stop' }],
})
assert(!emptyStop.content, 'empty stop content')
assert(emptyStop.errorClass === 'EMPTY_FINAL_CONTENT', 'empty stop class: ' + emptyStop.errorClass)

const recovered = n.normalizeResponse({
  choices: [{ message: { content: '', reasoning_content: '{"facts":[]}' }, finish_reason: 'stop' }],
})
assert(recovered.contentSource === 'REASONING_RECOVERY', 'recovery source')
assert(recovered.content.indexOf('facts') !== -1, 'recovery content')

const truncated = n.normalizeResponse(
  { choices: [{ message: { content: '{"name":"Valve","power":' }, finish_reason: 'length' }] },
  { repairTruncation: true },
)
assert(truncated.finishReason === 'length', 'length finish')
assert(truncated.contentSource === 'TRUNCATION_REPAIR' || truncated.content.indexOf('Valve') !== -1, 'truncation repair')

assert(n.classifyHttp(400, 'invalid temperature, only 1 allowed') === 'PARAM_REJECTED', 'param rejected')
assert(n.classifyHttp(400, 'temperature only 1 allowed') === 'PARAM_REJECTED', 'temp only 1')
const learned = n.learnableTemperature('temperature only 1 allowed')
assert(learned && learned.value === 1, 'learn temp 1')
assert(!n.learnableTemperature('model failed to generate a useful answer'), 'must not learn from generic error')

const emptyChoices = n.normalizeResponse({ choices: [] })
assert(emptyChoices.errorClass === 'EMPTY_CHOICES', 'empty choices')

const deepseek = n.normalizeResponse({
  choices: [{ message: { content: '{"summary":"ok"}' }, finish_reason: 'stop' }],
  model: 'deepseek-v4-flash',
})
assert(deepseek.content.indexOf('summary') !== -1, 'deepseek normal')

ASD.bg.modelHealth.reset()
ASD.bg.modelHealth.recordFailure('moonshot', 'kimi-k2.5', 10, 'PARAM_REJECTED')
const health = ASD.bg.modelHealth.get('moonshot', 'kimi-k2.5')
assert(health.failureCount === 0, 'PARAM_REJECTED must not pollute health')

const srcClient = fs.readFileSync(path.join(root, 'background/ai-client.js'), 'utf8')
assert(/skipHealthFailure/.test(srcClient), 'ai-client skips PARAM_REJECTED health')
assert(!/上一次输出被截断/.test(srcClient), 'must not retry_same with longer prompt on length')
assert((srcClient.match(/function normalizeResponse/g) || []).length === 0, 'ai-client has no normalizeResponse')

const adapter = fs.readFileSync(path.join(root, 'background/providers/openai-compatible.js'), 'utf8')
assert(/ASD\.responseNormalize/.test(adapter), 'adapter delegates normalize')

const levels = n.connectionLevels({ content: 'hello from model', contentSource: 'MESSAGE_CONTENT' })
assert(levels.liveness === 'ok', 'liveness without ok:true')
assert(levels.structured === 'limited', 'structured limited: ' + levels.structured)

const debug = JSON.stringify(kimiString.debug)
assert(debug.indexOf('sk-') === -1, 'debug key')
assert(!kimiString.raw, 'no raw')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, sources: [kimiString.contentSource, kimiArray.contentSource, recovered.contentSource] }))
