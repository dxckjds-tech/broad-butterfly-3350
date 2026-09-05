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
;['shared/constants.js', 'shared/provider-registry.js', 'shared/provider-configs.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
})

const migrated = sandbox.ASD.providerConfigs.migrate({
  provider: 'kimi',
  deepseekApiKey: 'ds-old',
  kimiApiKey: 'km-old',
  kimiBaseUrl: 'https://api.moonshot.cn/v1',
  kimiModel: 'kimi-k2.5',
})
assert(migrated.configs.deepseek.apiKey === 'ds-old', 'deepseek key')
assert(migrated.configs.moonshot.apiKey === 'km-old', 'moonshot key')
assert(migrated.configs.moonshot.enabled === true, 'moonshot enabled')
assert(migrated.configs.openai.apiKey === '', 'openai empty')
const legacy = sandbox.ASD.providerConfigs.syncLegacy(migrated, { provider: 'moonshot' })
assert(legacy.provider === 'kimi', 'legacy provider stays kimi')
assert(legacy.kimiApiKey === 'km-old', 'legacy kimi field kept')
assert(legacy.deepseekApiKey === 'ds-old', 'legacy deepseek field kept')

const second = sandbox.ASD.providerConfigs.migrate({
  provider: 'kimi',
  deepseekApiKey: 'ds-old',
  kimiApiKey: 'km-old',
  providerConfigs: migrated,
})
assert(second.configs.moonshot.apiKey === 'km-old', 'second migrate keeps new shape')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, deepseek: true, moonshot: true, legacyCompat: true }))
