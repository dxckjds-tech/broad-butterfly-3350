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
;['shared/result-schema.js', 'shared/task-types.js', 'shared/task-validators.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
})
const v = sandbox.ASD.taskValidators

const conn = v.validateByTask('connection_test', { ok: true, message: '连接成功' })
assert(conn.ok && conn.result.ok === true, 'connection_test ok')
const connExtra = v.validateByTask('connection_test', { ok: true })
assert(connExtra.ok && connExtra.result.message === '连接成功', 'connection_test default message')
const connBad = v.validateByTask('connection_test', { summary: { identity: 'x' } })
assert(!connBad.ok, 'connection_test must not accept diagnosis payload')

const tr = v.validateByTask('translation', { translation: '不锈钢球阀' })
assert(tr.ok && tr.result.translation === '不锈钢球阀', 'translation ok')
const trBad = v.validateByTask('translation', { summary: { identity: 'Valve' } })
assert(!trBad.ok, 'translation must not accept diagnosis payload')

const diagOk = v.validateByTask('product_diagnosis', {
  summary: { identity: 'Ball Valve', confidence: 80, status: 'VERIFIED' },
  facts: [],
  keywords: {},
  content: {},
})
assert(diagOk.ok, 'diagnosis still accepts product schema')
const diagConn = v.validateByTask('product_diagnosis', { ok: true, message: '连接成功' })
assert(!diagConn.ok && (diagConn.errors || []).indexOf('MISSING_SUMMARY') !== -1, 'diagnosis still requires summary')

const raw = v.validateByTask('raw_json', { any: 1 })
assert(raw.ok && raw.result.any === 1, 'raw_json')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, connection: conn.result, translation: tr.result.translation, diagnosisStrict: true }))
