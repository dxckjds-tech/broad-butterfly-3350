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

const sandbox = { ASD: {}, console: console }
sandbox.globalThis = sandbox
const ctx = vm.createContext(sandbox)
vm.runInContext(fs.readFileSync(path.join(root, 'shared/provider-registry.js'), 'utf8'), ctx)

const reg = sandbox.ASD.providerRegistry
const ids = reg.list().map(function (item) {
  return item.id
})
;['deepseek', 'moonshot', 'openai', 'anthropic', 'gemini', 'qwen', 'custom'].forEach(function (id) {
  assert(ids.indexOf(id) !== -1, 'missing provider ' + id)
  const item = reg.get(id)
  assert(item && item.adapter && item.apiStyle && item.name, id + ' metadata incomplete')
  assert(item.platformCapabilities && typeof item.platformCapabilities === 'object', id + ' platform metadata')
  assert(item.capabilities == null, id + ' must not inherit model capabilities from provider')
})

assert(reg.canonicalId('kimi') === 'moonshot', 'kimi alias → moonshot')
assert(reg.get('kimi').name.indexOf('Kimi') !== -1, 'kimi name')
assert(reg.get('claude').id === 'anthropic', 'claude alias')
assert(reg.get('google').id === 'gemini', 'google alias')
assert(reg.get('deepseek').apiStyle === 'openai-compatible', 'deepseek style')
assert(reg.get('anthropic').apiStyle === 'anthropic', 'anthropic style')
assert(reg.get('gemini').apiStyle === 'gemini', 'gemini style')
assert(reg.get('custom').userDeclaredCapabilities === true, 'custom user caps')
assert(reg.get('custom').supportsModelList === false, 'custom model list default off')
assert(reg.openaiCompatibleIds().indexOf('deepseek') !== -1, 'openai-compatible includes deepseek')
assert(reg.openaiCompatibleIds().indexOf('anthropic') === -1, 'anthropic is not openai-compatible')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, providers: ids, kimiAlias: 'moonshot' }))
