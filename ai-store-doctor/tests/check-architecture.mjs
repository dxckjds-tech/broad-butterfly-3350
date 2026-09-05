#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const errors = []

if (manifest.background?.type === 'module') errors.push('background must not set type:module')
if (manifest.background?.service_worker !== 'background/service-worker.js') {
  errors.push('service_worker path mismatch')
}
if (JSON.stringify(manifest.permissions) !== JSON.stringify(['sidePanel', 'storage', 'activeTab'])) {
  errors.push('permissions changed: ' + JSON.stringify(manifest.permissions))
}
const hosts = [
  'https://*.made-in-china.com/*',
  'https://*.vemic.com/*',
  'https://api.deepseek.com/*',
  'https://api.moonshot.cn/*',
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://dashscope.aliyuncs.com/*',
]
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(hosts)) {
  errors.push('host_permissions changed')
}
if (!manifest.optional_host_permissions || manifest.optional_host_permissions.indexOf('https://*/*') === -1) {
  errors.push('optional_host_permissions must allow custom HTTPS origins')
}
const csp = manifest.content_security_policy && manifest.content_security_policy.extension_pages
if (!csp) errors.push('extension_pages CSP missing')
if (csp && /unsafe-eval|unsafe-inline|https?:\/\/|cdn/i.test(csp)) errors.push('CSP must not allow eval or remote script')
if (manifest.version !== '1.6.0') errors.push('manifest version must be 1.6.0, got ' + manifest.version)

const sw = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8')
const listenerCount = (sw.match(/onMessage\.addListener/g) || []).length
if (listenerCount !== 1) errors.push('service-worker must register exactly one onMessage listener, found ' + listenerCount)
if (!sw.includes('importScripts(')) errors.push('service-worker missing importScripts')
if (!/importScripts\([\s\S]*storage-keys\.js[\s\S]*settings\.js/.test(sw)) {
  errors.push('importScripts must load storage-keys.js before settings.js')
}

const panel = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8')
const scripts = [...panel.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])
const expectedPrefix = ['shared/dom.js', 'sidepanel/state.js', 'sidepanel/render/helpers.js']
expectedPrefix.forEach((file, i) => {
  if (scripts[i] !== file) errors.push(`sidepanel script[${i}] expected ${file}, got ${scripts[i]}`)
})
if (scripts[scripts.length - 1] !== 'sidepanel/app.js') errors.push('sidepanel app.js must load last')

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'tests' || name === 'node_modules' || name === 'scripts' || name === 'dist') continue
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full, acc)
    else if (name.endsWith('.js')) acc.push(full)
  }
  return acc
}

for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8')
  if (/^\s*import\s/m.test(text) || /export\s+\{/.test(text) || /^\s*export\s/m.test(text)) {
    errors.push('ESM import/export found in ' + path.relative(root, file))
  }
}

const contentJs = manifest.content_scripts[0].js
if (contentJs[contentJs.length - 1] !== 'content-script.js') {
  errors.push('content_scripts must keep content-script.js last')
}
const requiredPrefix = ['shared/constants.js', 'shared/product-fields.js', 'shared/pii-patterns.js']
requiredPrefix.forEach((file, i) => {
  if (contentJs[i] !== file) errors.push(`content_scripts.js[${i}] expected ${file}, got ${contentJs[i]}`)
})

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, scripts, contentJs, permissions: manifest.permissions }))
