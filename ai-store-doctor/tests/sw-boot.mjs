#!/usr/bin/env node
/** Load background scripts in importScripts order with a chrome mock. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const swSrc = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8')
const match = swSrc.match(/importScripts\(([\s\S]*?)\)/)
if (!match) throw new Error('importScripts not found')
const files = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
const resolved = files.map((rel) => path.normalize(path.join(root, 'background', rel)))

const chrome = {
  runtime: {
    onInstalled: {
      addListener(fn) {
        chrome._onInstalled = fn
      },
    },
    onMessage: {
      addListener(fn) {
        chrome._onMessage = fn
      },
    },
    openOptionsPage: async () => {},
  },
  sidePanel: { setPanelBehavior: async () => {} },
  storage: {
    local: {
      async get(keys) {
        if (keys == null) throw new Error('get(null) forbidden')
        return {}
      },
      async set() {},
    },
    onChanged: { addListener() {} },
  },
  tabs: {
    query: async () => [],
    create: async () => ({ id: 1 }),
    update: async () => {},
    get: async () => ({ id: 1, url: 'https://sample.made-in-china.com/p', active: false }),
    remove: async () => {},
    sendMessage: async () => ({ fields: { title: 'x' } }),
    onUpdated: { addListener() {}, removeListener() {} },
  },
}

const sandbox = { chrome, self: null, globalThis: null, console, setTimeout, clearTimeout, fetch }
sandbox.self = sandbox
sandbox.globalThis = sandbox
const context = vm.createContext(sandbox)

for (const file of resolved) {
  const code = fs.readFileSync(file, 'utf8')
  try {
    vm.runInContext(code, context, { filename: file })
  } catch (error) {
    throw new Error('SW script failed ' + path.relative(root, file) + ': ' + error.message)
  }
}
vm.runInContext(swSrc.replace(/importScripts\([\s\S]*?\)\n/, ''), context, { filename: 'service-worker.js' })

if (!sandbox.ASD?.bg?.messageHandler) throw new Error('ASD.bg.messageHandler missing')
if (typeof chrome._onMessage !== 'function') throw new Error('onMessage not registered synchronously')

const reply = (msg) =>
  new Promise((resolve) => {
    const keep = chrome._onMessage(msg, {}, resolve)
    if (keep !== true) throw new Error('onMessage must return true for async sendResponse')
  })

const unknown = await reply({ type: 'NOPE' })
if (unknown.reason !== 'UNKNOWN_MESSAGE') throw new Error('unknown routing broken')
const active = await reply({ type: 'GET_ACTIVE_URL' })
if (active.ok !== false) throw new Error('GET_ACTIVE_URL without tab should fail')
const open = await reply({ type: 'OPEN_OPTIONS' })
if (!open.ok) throw new Error('OPEN_OPTIONS failed')

console.log(
  JSON.stringify({
    ok: true,
    importScripts: files,
    hasPrompt: Boolean(sandbox.ASD.bg.promptBuilder.SYSTEM_PROMPT),
    promptVersion: sandbox.ASD.constants.PROMPT_VERSION,
    extensionVersion: sandbox.ASD.constants.EXTENSION_VERSION,
  }),
)
