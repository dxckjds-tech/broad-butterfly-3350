#!/usr/bin/env node
/** Boot options page scripts and load legacy storage into the form. */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = fs.readFileSync(path.join(root, 'options.html'), 'utf8')
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])

const stored = {
  provider: 'kimi',
  kimiApiKey: 'kimi-legacy',
  kimiBaseUrl: 'https://api.moonshot.cn/v1',
  apiKey: 'deepseek-legacy',
}

const chrome = {
  storage: {
    local: {
      async get(keys) {
        if (keys == null) throw new Error('get(null) forbidden')
        const list = Array.isArray(keys) ? keys : Object.keys(keys)
        const out = {}
        list.forEach((k) => {
          if (k in stored) out[k] = stored[k]
        })
        return out
      },
      async set(data) {
        Object.assign(stored, data)
      },
    },
    onChanged: { addListener() {} },
  },
  runtime: { sendMessage: async () => ({ ok: false, reason: 'no live AI in smoke test' }) },
}

const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), {
  url: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/options.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
})
dom.window.chrome = chrome
for (const src of scripts) {
  try {
    dom.window.eval(fs.readFileSync(path.join(root, src), 'utf8'))
  } catch (error) {
    throw new Error('Failed loading ' + src + ': ' + error.message)
  }
}
await new Promise((r) => setTimeout(r, 20))
const $ = (id) => dom.window.document.getElementById(id)
if ($('provider').value !== 'kimi') throw new Error('provider not restored')
if ($('kimiApiKey').value !== 'kimi-legacy') throw new Error('kimi key not restored')
if ($('deepseekApiKey').value !== 'deepseek-legacy') throw new Error('legacy apiKey not mapped into DeepSeek field')
if ($('kimiPanel').hidden) throw new Error('kimi panel should be visible')
if (!$('deepseekPanel').hidden) throw new Error('deepseek panel should be hidden')
console.log(
  JSON.stringify({
    ok: true,
    scripts,
    provider: $('provider').value,
    kimiKeyLoaded: true,
    legacyDeepseekKeyLoaded: true,
    kimiVisible: !$('kimiPanel').hidden,
  }),
)
