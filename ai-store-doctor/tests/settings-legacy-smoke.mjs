#!/usr/bin/env node
/** Options + settings() still read legacy apiKey/baseUrl/model/thinking. */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const stored = {
  apiKey: 'legacy-deepseek-key',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  thinking: 'disabled',
  provider: 'deepseek',
}

const chromeMock = {
  storage: {
    local: {
      async get(keys) {
        if (keys == null) throw new Error('get(null) is forbidden')
        const list = Array.isArray(keys) ? keys : Object.keys(keys)
        const out = {}
        list.forEach((k) => {
          if (k in stored) out[k] = stored[k]
        })
        return out
      },
      async set() {},
      onChanged: { addListener() {} },
    },
    onChanged: { addListener() {} },
  },
}

const dom = new JSDOM('<!DOCTYPE html><html></html>', {
  url: 'https://sample.made-in-china.com/',
  runScripts: 'outside-only',
})
dom.window.chrome = chromeMock
globalThis.chrome = chromeMock
for (const file of [
  'shared/constants.js',
  'shared/storage-keys.js',
  'shared/provider-registry.js',
  'shared/provider-configs.js',
  'background/settings.js',
]) {
  dom.window.eval(fs.readFileSync(path.join(root, file), 'utf8'))
}
const cfg = await dom.window.ASD.bg.settings.load()
if (cfg.deepseekApiKey !== 'legacy-deepseek-key') throw new Error('legacy apiKey not mapped: ' + cfg.deepseekApiKey)
if (cfg.deepseekModel !== 'deepseek-v4-flash') throw new Error('model default mismatch')
if (cfg.provider !== 'deepseek') throw new Error('provider mismatch')
if (!cfg.providerConfigs || cfg.providerConfigs.configs.deepseek.apiKey !== 'legacy-deepseek-key') {
  throw new Error('legacy key not migrated into providerConfigs')
}
console.log(JSON.stringify({ ok: true, deepseekApiKey: 'legacy-deepseek-key', provider: cfg.provider, model: cfg.deepseekModel, migrated: true }))
