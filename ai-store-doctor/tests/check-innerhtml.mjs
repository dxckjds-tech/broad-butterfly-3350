#!/usr/bin/env node
/**
 * Scan extension JS for innerHTML assignments that interpolate values
 * without esc(). Existing stock UI may use esc/badge/translateButton.
 * New code should use ASD.dom instead of innerHTML.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allowFns = ['esc(', 'badge(', 'translateButton(', 'encodeURIComponent(']

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'tests' || name === 'node_modules' || name === 'icons') continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, acc)
    else if (name.endsWith('.js') || name.endsWith('.html')) acc.push(full)
  }
  return acc
}

const files = walk(root)
const hits = []
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (!/innerHTML\s*=/.test(line)) return
    if (!/\$\{/.test(line)) return
    const interpolations = [...line.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1])
    const unsafe = interpolations.filter((expr) => !allowFns.some((fn) => expr.includes(fn)))
    // Allow numeric/state flags that are not untrusted strings
    const reallyUnsafe = unsafe.filter((expr) => {
      if (/props\.(elapsed|tab|subtab|loading)/.test(expr)) return false
      if (/^[a-zA-Z0-9_.?]+$/.test(expr.trim()) && /(length|tab|subtab|elapsed|attempts|frameCount)/.test(expr))
        return false
      if (/views\[props\.tab\]/.test(expr)) return false
      return true
    })
    if (reallyUnsafe.length) {
      hits.push({ file: path.relative(root, file), line: i + 1, exprs: reallyUnsafe, preview: line.trim().slice(0, 160) })
    }
  })
}

if (hits.length) {
  console.error(JSON.stringify({ ok: false, hits }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, scanned: files.length, note: 'no unescaped innerHTML interpolations found' }))
