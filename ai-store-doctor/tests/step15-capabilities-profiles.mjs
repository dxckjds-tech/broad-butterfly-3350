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
;['shared/provider-registry.js', 'shared/model-capabilities.js', 'shared/task-profiles.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
})

const caps = sandbox.ASD.modelCapabilities
const flash = caps.resolve('deepseek', 'deepseek-v4-flash')
assert(flash.vision === false, 'flash no vision')
assert(flash.reasoning === true, 'flash reasoning from known table')
const k25 = caps.resolve('kimi', 'kimi-k2.5')
assert(k25.vision === true, 'kimi-k2.5 vision from known table, not business regex')
const unknown = caps.resolve('custom', 'my-unknown-model')
assert(unknown.vision === false && unknown.reasoning === false, 'unknown defaults safe')
const override = caps.resolve('custom', 'my-unknown-model', { vision: true })
assert(override.vision === true, 'user override wins')
assert(caps.hasRequired(k25, { vision: true }) === true, 'k25 has vision')
assert(caps.hasRequired(flash, { vision: true }) === false, 'flash lacks vision')

const profiles = sandbox.ASD.taskProfiles
assert(profiles.get('vision_analysis').required.vision === true, 'vision task')
assert(profiles.get('translation').required.text === true, 'translation text')
const diag = profiles.requiredFor('product_diagnosis', { hasImages: true })
assert(diag.vision === true, 'diagnosis images upgrade vision to required')
const diagNo = profiles.requiredFor('product_diagnosis', { hasImages: false })
assert(!diagNo.vision, 'diagnosis without images keeps vision preferred only')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, flash: flash, kimiVision: k25.vision, unknownSafe: true }))
