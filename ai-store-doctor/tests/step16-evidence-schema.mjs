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
;['shared/result-schema.js', 'shared/orchestration-schemas.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
})
const schemas = sandbox.ASD.orchestrationSchemas

const vision = schemas.normalizeEvidence({
  identityCandidates: [{ name: 'Valve', confidence: 70, evidence: ['image'] }],
  evidence: [
    { field: 'material', value: 'Stainless Steel', sourceType: 'vision', sourceRef: 'img1', status: 'VERIFIED', confidence: 78 },
  ],
  imageObservations: [{ imageRef: 'img1', observation: 'metal body', confidence: 70 }],
  unknowns: [],
})
assert(vision.ok, 'vision evidence ok')
assert(vision.result.evidence[0].status === 'OBSERVED', 'E vision cannot be VERIFIED')
assert(vision.result.evidence[0].sourceType === 'vision', 'vision sourceType kept')

const page = schemas.normalizeEvidence({
  identityCandidates: [],
  evidence: [
    { field: 'material', value: 'Stainless Steel', sourceType: 'spec_table', sourceRef: 'specs.material', status: 'VERIFIED', confidence: 95 },
  ],
  imageObservations: [],
  unknowns: [],
})
assert(page.ok && page.result.evidence[0].status === 'VERIFIED', 'F page spec may be VERIFIED')

const inferred = schemas.normalizeEvidence({
  identityCandidates: [],
  evidence: [{ field: 'x', value: 'y', sourceType: 'model', status: 'INFERRED', confidence: 50 }],
  imageObservations: [],
  unknowns: [],
})
assert(inferred.result.evidence[0].status === 'OBSERVED', 'stage1 inferred demoted')

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, visionStatus: vision.result.evidence[0].status, pageStatus: page.result.evidence[0].status }))
