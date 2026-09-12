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

const prior = {
  evidence: [
    { field: 'material', value: 'Stainless Steel', sourceType: 'vision', sourceRef: 'img1', status: 'OBSERVED', confidence: 78 },
    { field: 'size', value: 'DN50', sourceType: 'spec_table', sourceRef: 'specs.size', status: 'VERIFIED', confidence: 90 },
  ],
}

const upgraded = schemas.normalizeDiagnosis(
  {
    summary: 'ok',
    identity: { name: 'Ball Valve', confidence: 80 },
    facts: [
      { label: 'material', value: 'Stainless Steel', status: 'VERIFIED', sourceType: 'product_field', sourceRef: 'img1' },
      { label: 'size', value: 'DN50', status: 'VERIFIED', sourceType: 'spec_table', sourceRef: 'specs.size' },
    ],
    diagnosis: { strengths: [], issues: [], priorities: [] },
    keywordStrategy: { primary: [], secondary: [], blocked: [], rationale: [] },
    contentBrief: { titleGoals: [], detailGoals: [], faqGoals: [], geoGoals: [] },
  },
  prior,
  { sourceModel: 'gpt-4o', sourceProvider: 'openai' },
)
assert(upgraded.ok, 'diagnosis ok')
const material = upgraded.result.facts.find(function (item) { return item.label === 'material' })
const size = upgraded.result.facts.find(function (item) { return item.label === 'size' })
assert(material.status !== 'VERIFIED', 'E vision/OBSERVED cannot become VERIFIED, got ' + material.status)
assert(material.sourceType === 'vision', 'provenance sourceType locked, got ' + material.sourceType)
assert(size.status === 'VERIFIED' && size.sourceType === 'spec_table', 'F page VERIFIED stays')

const unknownDiag = {
  identity: { name: 'Valve', confidence: 50 },
  facts: [{ label: 'cert', value: 'CE', status: 'UNKNOWN', sourceType: 'model' }],
  diagnosis: { strengths: [], issues: [], priorities: [] },
  keywordStrategy: { primary: [], secondary: [], blocked: [], rationale: [] },
  contentBrief: { titleGoals: [], detailGoals: [], faqGoals: [], geoGoals: [] },
}
const content = schemas.finalizeOrchestrationReport(unknownDiag, {
  summary: { identity: 'Valve', confidence: 50, status: 'UNKNOWN' },
  facts: unknownDiag.facts,
  keywords: {},
  content: { detail: { specifications: [{ name: 'Certification', value: 'CE' }], overview: 'A valve' } },
})
assert(content.ok, 'finalize ok')
assert(
  !content.result.content.detail.specifications.some(function (item) { return item.value === 'CE' }),
  'G UNKNOWN must not become product spec',
)

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, material: material.status, size: size.status, unknownStripped: true }))
