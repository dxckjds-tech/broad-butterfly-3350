#!/usr/bin/env node
/**
 * Render HTML smoke: load a frozen sample report through render(props)
 * and compare tab HTML against snapshots from v1.5.1 sidepanel.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const write = process.argv.includes('--write')
const snapDir = path.join(root, 'tests', 'fixtures', 'render')

const sample = {
  tab: 0,
  subtab: 0,
  fields: {
    title: 'Canister Vacuum Cleaner 20L',
    category: 'Vacuum Cleaners',
    specs: ['Capacity：20 L'],
    formFields: ['Capacity：20L'],
    visibleText: 'sample text',
    images: [{ src: 'https://img.made-in-china.com/sample.jpg' }],
    frameCount: 1,
    url: 'https://sample.made-in-china.com/p/1',
  },
  meta: { provider: 'DeepSeek', model: 'deepseek-v4-flash', attempts: 1, usage: { total_tokens: 100 } },
  manualIdentityDraft: '',
  report: {
    summary: {
      identity: 'Canister Vacuum Cleaner',
      confidence: 82,
      dataCompleteness: 75,
      contentReadiness: 48,
      status: 'BLOCKED',
      conflicts: ['标题与商品分组冲突'],
      nextActions: ['确认商品身份'],
    },
    identityCandidates: [
      { name: 'Canister Vacuum Cleaner', confidence: 82, support: ['商品分组'], oppose: ['标题 Steam'] },
    ],
    facts: [{ label: '容量', value: '20 L', status: 'VERIFIED', source: '规格', note: '页面字段' }],
    keywords: {
      current: ['steam cleaner'],
      blocked: [{ keyword: 'steam mop', reason: 'PRODUCT_MISMATCH' }],
      candidates: [{ keyword: 'canister vacuum cleaner', matchScore: 91, intent: '采购', basis: '商品匹配' }],
    },
    content: {
      titles: [{ text: 'Canister Vacuum Cleaner 20L', style: 'direct', factsUsed: ['20L'], excluded: ['CE'] }],
      detail: {
        headline: '20L Canister Vacuum',
        overview: 'Home cleaning machine',
        highlights: ['20L tank'],
        specifications: [{ name: 'Capacity', value: '20 L' }],
        applications: ['Home'],
        packagingDelivery: 'Carton',
        buyerNote: 'Confirm power rating',
      },
      faq: [{ question: 'Wet pickup?', answer: 'Unknown' }],
      geo: {
        headline: 'What is this product?',
        directAnswer: 'A 20L canister vacuum.',
        productFacts: ['Capacity 20 L'],
        companyContext: 'Company information is not available on the source page',
        buyerQuestions: [{ question: 'MOQ?', answer: 'Not specified' }],
        sourcingGuidance: ['Confirm voltage'],
        evidenceBasis: ['title', 'specs'],
      },
    },
    debug: { missingFields: ['额定功率'], warnings: ['认证未验证'] },
  },
}

function loadPanel() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <div id="panel"><div id="summary"></div><div id="tabs"></div><div id="content"></div></div>
    </body></html>`,
    { url: 'https://sample.made-in-china.com/', runScripts: 'outside-only' },
  )
  const files = [
    'sidepanel/state.js',
    'sidepanel/render/helpers.js',
    'sidepanel/render/overview.js',
    'sidepanel/render/truth.js',
    'sidepanel/render/keywords.js',
    'sidepanel/render/content.js',
    'sidepanel/render/debug.js',
  ]
  for (const file of files) {
    dom.window.eval(fs.readFileSync(path.join(root, file), 'utf8'))
  }
  return dom.window
}

function htmlFor(window, tab, subtab) {
  const props = { ...sample, tab, subtab }
  const views = [
    window.ASD.sidepanel.render.overview,
    window.ASD.sidepanel.render.truth,
    window.ASD.sidepanel.render.keywords,
    window.ASD.sidepanel.render.content,
    window.ASD.sidepanel.render.debug,
  ]
  return views[tab](props)
}

function main() {
  fs.mkdirSync(snapDir, { recursive: true })
  const window = loadPanel()
  const names = ['overview', 'truth', 'keywords', 'content-title', 'content-detail', 'content-faq', 'content-geo', 'debug']
  const cases = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 0],
  ]
  let failed = 0
  const results = []
  cases.forEach(([tab, subtab], i) => {
    const html = htmlFor(window, tab, subtab)
    const file = path.join(snapDir, `${names[i]}.html`)
    if (write) {
      fs.writeFileSync(file, html)
      results.push({ name: names[i], status: 'wrote' })
      return
    }
    if (!fs.existsSync(file)) {
      failed += 1
      results.push({ name: names[i], status: 'missing' })
      return
    }
    const expected = fs.readFileSync(file, 'utf8')
    if (expected === html) results.push({ name: names[i], status: 'PASS' })
    else {
      failed += 1
      results.push({ name: names[i], status: 'FAIL' })
      fs.writeFileSync(file.replace('.html', '.actual.html'), html)
    }
  })
  console.log(JSON.stringify({ failed, results }, null, 2))
  if (write) return
  if (failed) process.exit(1)
}

main()
