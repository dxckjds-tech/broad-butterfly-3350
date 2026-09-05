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
;['shared/provider-registry.js', 'shared/model-capabilities.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
})
const caps = sandbox.ASD.modelCapabilities
const flash = caps.resolve('deepseek', 'deepseek-v4-flash')
assert(flash.vision === false && flash.reasoning === true, 'known deepseek table')
const k25 = caps.resolve('kimi', 'kimi-k2.5')
assert(k25.vision === true, 'known moonshot table via alias')
const unknown = caps.resolve('custom', 'totally-unknown-model-xyz')
assert(unknown.vision === false && unknown.reasoning === false, 'safe defaults')
const over = caps.resolve('custom', 'totally-unknown-model-xyz', { vision: true, reasoning: true })
assert(over.vision === true && over.reasoning === true, 'user override')
assert(caps.hasRequired(flash, { vision: true }) === false, 'required filter')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, visionUnknown: false, kimiVision: true }))
