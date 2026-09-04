#!/usr/bin/env node
/**
 * Offline regression for content extraction + compactFields payload.
 * Does not call DeepSeek/Kimi. state.report for these fixtures is null
 * because v1.5.1 only fills report after a live ANALYZE_PRODUCT call.
 *
 * Usage:
 *   node tests/run-regression.mjs              # compare against baselines
 *   node tests/run-regression.mjs --write      # (re)write baseline files
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { compactFields as compactFieldsCopy } from './lib/compact-fields.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturesDir = path.join(root, 'tests', 'fixtures')
const write = process.argv.includes('--write')

const FIXTURES = [
  {
    id: '01-mic-product-detail',
    html: '01-mic-product-detail.html',
    url: 'https://sample.made-in-china.com/product/canister-vacuum-cleaner-20l.html',
  },
  {
    id: '02-vemic-product-edit',
    html: '02-vemic-product-edit.html',
    url: 'https://sample.vemic.com/product/edit?id=8823910',
  },
  {
    id: '03-vemic-product-list',
    html: '03-vemic-product-list.html',
    url: 'https://sample.vemic.com/product/list',
  },
  {
    id: '04-dynamic-product-page',
    html: '04-dynamic-product-page.html',
    url: 'https://sample.made-in-china.com/product/loading.html',
  },
  {
    id: '05-special-jsonld-iframe',
    html: '05-special-jsonld-iframe.html',
    url: 'https://sample.made-in-china.com/product/industrial-ball-valve-dn50.html',
  },
]

function loadJsdom() {
  try {
    return require('jsdom')
  } catch {
    throw new Error('jsdom is required for tests. Run: cd tests && npm install')
  }
}

function mockChrome(window) {
  window.chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
    },
  }
}

function loadContentScript(window) {
  const src = fs.readFileSync(path.join(root, 'content-script.js'), 'utf8')
  window.eval(src)
}

function normalizeFields(fields) {
  if (!fields) return fields
  const copy = JSON.parse(JSON.stringify(fields))
  delete copy.readAt
  return copy
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2) + '\n'
}

function extractFromFixture(JSDOM, fixture) {
  const html = fs.readFileSync(path.join(fixturesDir, fixture.html), 'utf8')
  const dom = new JSDOM(html, {
    url: fixture.url,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  })
  mockChrome(dom.window)
  loadContentScript(dom.window)
  if (typeof dom.window.extractFields !== 'function') {
    throw new Error('extractFields is not available after loading content-script.js')
  }
  return dom.window.extractFields()
}

function loadPayloadBuilder() {
  const payloadPath = path.join(root, 'background', 'payload-builder.js')
  if (!fs.existsSync(payloadPath)) return null
  const { JSDOM } = loadJsdom()
  const dom = new JSDOM('<!DOCTYPE html><html></html>', { url: 'https://sample.made-in-china.com/', runScripts: 'outside-only' })
  const scripts = [
    path.join(root, 'shared', 'constants.js'),
    payloadPath,
  ]
  for (const file of scripts) {
    if (!fs.existsSync(file)) continue
    dom.window.eval(fs.readFileSync(file, 'utf8'))
  }
  return dom.window.ASD?.bg?.payloadBuilder?.compactFields || null
}

function diffJson(actual, expected, label) {
  const a = stableStringify(actual)
  const e = stableStringify(expected)
  if (a === e) return null
  return `${label} differs from baseline (${a.length} vs ${e.length} bytes)`
}

async function main() {
  const { JSDOM } = loadJsdom()
  const compactFn = loadPayloadBuilder() || compactFieldsCopy
  const usingSplit = compactFn !== compactFieldsCopy
  let failed = 0
  const results = []

  for (const fixture of FIXTURES) {
    const fields = extractFromFixture(JSDOM, fixture)
    const fieldsNorm = normalizeFields(fields)
    const compact = compactFn(fields)
    const report = null

    const fieldsFile = path.join(fixturesDir, `${fixture.id}.baseline.fields.json`)
    const reportFile = path.join(fixturesDir, `${fixture.id}.baseline.report.json`)
    const compactFile = path.join(fixturesDir, `${fixture.id}.baseline.compact.json`)

    if (write) {
      fs.writeFileSync(fieldsFile, stableStringify(fieldsNorm))
      fs.writeFileSync(reportFile, stableStringify(report))
      fs.writeFileSync(compactFile, stableStringify(compact))
      results.push({ id: fixture.id, status: 'wrote' })
      continue
    }

    if (!fs.existsSync(fieldsFile) || !fs.existsSync(reportFile)) {
      console.error(`Missing baseline for ${fixture.id}. Run with --write first.`)
      failed += 1
      continue
    }

    const expectedFields = JSON.parse(fs.readFileSync(fieldsFile, 'utf8'))
    const expectedReport = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
    const expectedCompact = fs.existsSync(compactFile) ? JSON.parse(fs.readFileSync(compactFile, 'utf8')) : null

    const fieldDiff = diffJson(fieldsNorm, expectedFields, 'state.fields')
    const reportDiff = diffJson(report, expectedReport, 'state.report')
    const compactDiff = expectedCompact ? diffJson(compact, expectedCompact, 'compactFields') : null

    if (fieldDiff || reportDiff || compactDiff) {
      failed += 1
      results.push({
        id: fixture.id,
        status: 'FAIL',
        fieldDiff,
        reportDiff,
        compactDiff,
      })
      if (fieldDiff) {
        fs.writeFileSync(path.join(fixturesDir, `${fixture.id}.actual.fields.json`), stableStringify(fieldsNorm))
      }
      if (compactDiff) {
        fs.writeFileSync(path.join(fixturesDir, `${fixture.id}.actual.compact.json`), stableStringify(compact))
      }
    } else {
      results.push({ id: fixture.id, status: 'PASS' })
    }
  }

  console.log(JSON.stringify({ usingSplitPayloadBuilder: usingSplit, failed, results }, null, 2))
  if (write) {
    console.log('Baselines written.')
    return
  }
  if (failed) {
    console.error(`Regression failed: ${failed} fixture(s) differ from v1.5.1 baseline.`)
    process.exit(1)
  }
  console.log('All fixtures match v1.5.1 baseline (state.fields / state.report / compactFields).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
