#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = { globalThis: null, console }
sandbox.globalThis = sandbox
const ctx = vm.createContext(sandbox)
vm.runInContext(fs.readFileSync(path.join(root, 'shared/result-schema.js'), 'utf8'), ctx)
const schema = sandbox.ASD.schema

const cases = [
  {
    name: 'confidence 0.85',
    input: { summary: { identity: 'A', confidence: 0.85, status: 'VERIFIED' } },
    expect: (out) => out.ok && out.result.summary.confidence === 85,
  },
  {
    name: 'confidence 150',
    input: { summary: { identity: 'A', confidence: 150, status: 'VERIFIED' } },
    expect: (out) => out.ok && out.result.summary.confidence === 100,
  },
  {
    name: 'confidence "-1"',
    input: { summary: { identity: 'A', confidence: '-1', status: 'VERIFIED' } },
    expect: (out) => out.ok && out.result.summary.confidence === 0,
  },
  {
    name: 'status verified',
    input: { summary: { identity: 'A', status: 'verified' }, facts: [{ label: 'x', status: 'verified' }] },
    expect: (out) => out.ok && out.result.facts[0].status === 'VERIFIED',
  },
  {
    name: 'status CONFIRMED',
    input: { summary: { identity: 'A', status: 'VERIFIED' }, facts: [{ label: 'x', status: 'CONFIRMED' }] },
    expect: (out) => out.ok && out.result.facts[0].status === 'UNKNOWN' && out.repaired.some((x) => /CONFIRMED/.test(x)),
  },
  {
    name: 'facts object',
    input: { summary: { identity: 'A', status: 'VERIFIED' }, facts: { a: { label: 'L', value: 'V', status: 'OBSERVED' } } },
    expect: (out) => out.ok && out.result.facts.length === 1 && out.result.facts[0].label === 'L',
  },
  {
    name: 'facts null',
    input: { summary: { identity: 'A', status: 'VERIFIED' }, facts: null },
    expect: (out) => out.ok && Array.isArray(out.result.facts) && out.result.facts.length === 0,
  },
  {
    name: 'content.detail string',
    input: { summary: { identity: 'A', status: 'VERIFIED' }, content: { detail: 'plain text overview' } },
    expect: (out) => out.ok && out.result.content.detail.overview === 'plain text overview',
  },
  {
    name: 'content.geo array',
    input: {
      summary: { identity: 'A', status: 'VERIFIED' },
      content: { geo: [{ headline: 'H', directAnswer: 'D' }] },
    },
    expect: (out) => out.ok && out.result.content.geo.headline === 'H',
  },
  {
    name: 'identityCandidates null',
    input: { summary: { identity: 'A', status: 'VERIFIED' }, identityCandidates: null },
    expect: (out) => out.ok && Array.isArray(out.result.identityCandidates) && out.result.identityCandidates.length === 0,
  },
  {
    name: 'missing summary',
    input: { facts: [] },
    expect: (out) => !out.ok && out.fatal && out.errors.indexOf('MISSING_SUMMARY') !== -1,
  },
  {
    name: 'empty {}',
    input: {},
    expect: (out) => !out.ok && out.fatal,
  },
  {
    name: 'markdown wrapped JSON',
    input: '```json\n{"summary":{"identity":"Valve","confidence":70,"status":"VERIFIED"}}\n```',
    expect: (out) => out.ok && out.result.summary.identity === 'Valve' && out.result.summary.confidence === 70,
  },
  {
    name: 'extra fields',
    input: { summary: { identity: 'A', confidence: 10, status: 'UNKNOWN' }, extra: { foo: 1 }, leftover: true },
    expect: (out) => out.ok && out.result.summary.identity === 'A' && !('extra' in out.result),
  },
  {
    name: 'keywords format error',
    input: { summary: { identity: 'A', status: 'VERIFIED' }, keywords: ['bad'] },
    expect: (out) => out.ok && Array.isArray(out.result.keywords.current) && out.repaired.indexOf('keywords-format') !== -1,
  },
]

const results = cases.map(function (item) {
  const out = schema.normalizeAndValidate(item.input)
  const pass = !!item.expect(out)
  return { name: item.name, status: pass ? 'PASS' : 'FAIL', ok: out.ok, repaired: out.repaired, errors: out.errors }
})
const failed = results.filter((x) => x.status === 'FAIL')
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed, results }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2))
