#!/usr/bin/env node
/** Boot sidepanel scripts in order and render the empty state. */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8')
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])

const chrome = {
  runtime: {
    sendMessage: async (msg) => {
      if (msg?.type === 'GET_ACTIVE_URL') return { ok: false, reason: '无法取得当前页面 URL' }
      if (msg?.type === 'OPEN_OPTIONS') return { ok: true }
      return { ok: false, reason: 'UNKNOWN_MESSAGE' }
    },
  },
}

const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), {
  url: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sidepanel.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
})
dom.window.chrome = chrome
dom.window.navigator.clipboard = { writeText: async () => {} }

for (const src of scripts) {
  const file = path.join(root, src)
  try {
    dom.window.eval(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error('Failed loading ' + src + ': ' + error.message)
  }
  if (src === 'shared/dom.js' && !dom.window.ASD?.dom) throw new Error('ASD.dom missing after ' + src)
  if (src === 'sidepanel/state.js' && !dom.window.ASD?.sidepanel?.state) throw new Error('ASD.sidepanel.state missing')
}

const ASD = dom.window.ASD
if (!ASD.sidepanel.app) throw new Error('ASD.sidepanel.app missing')
if (!ASD.sidepanel.actions) throw new Error('ASD.sidepanel.actions missing')
ASD.sidepanel.app.render()
const summary = dom.window.document.getElementById('summary').textContent
const content = dom.window.document.getElementById('content').textContent
const tabs = [...dom.window.document.querySelectorAll('.tab-btn')].map((n) => n.textContent)
if (!summary.includes('读取商品 URL')) throw new Error('empty summary mismatch: ' + summary)
if (!content.includes('请粘贴商品 URL')) throw new Error('empty content mismatch: ' + content)
if (tabs.join(',') !== '概览,商品真相,关键词,内容优化,证据与调试') throw new Error('tabs mismatch ' + tabs.join(','))
const settings = dom.window.document.getElementById('scenarioToggle')
if (settings.textContent !== 'API 设置') throw new Error('settings label mismatch')
const analyze = dom.window.document.querySelector('[data-action="analyze"]')
if (analyze.textContent !== 'AI 分析商品') throw new Error('analyze label mismatch')
console.log(
  JSON.stringify({
    ok: true,
    scripts,
    tabs,
    summary: summary.trim(),
    content: content.trim(),
    settings: settings.textContent,
    analyze: analyze.textContent,
  }),
)
