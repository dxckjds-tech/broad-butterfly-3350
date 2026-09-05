#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const constants = fs.readFileSync(path.join(root, 'shared/constants.js'), 'utf8')
const versionMatch = constants.match(/EXTENSION_VERSION:\s*'([^']+)'/)
const version = versionMatch ? versionMatch[1] : '0.0.0'
const distDir = path.join(root, 'dist')
fs.mkdirSync(distDir, { recursive: true })
const zipName = 'AI-Store-Doctor-v' + version + '-rc1.zip'
const zipPath = path.join(distDir, zipName)

const include = [
  'manifest.json',
  'sidepanel.html',
  'options.html',
  'options.js',
  'content-script.js',
  'styles.css',
  'PRIVACY.md',
  'README.md',
  'icons',
  'shared',
  'content',
  'background',
  'sidepanel',
]

const missing = include.filter(function (item) {
  return !fs.existsSync(path.join(root, item))
})
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing: missing }))
  process.exit(1)
}

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
execFileSync('zip', ['-r', '-q', zipPath, ...include, '-x', '*.DS_Store'], { cwd: root })

const listing = execFileSync('zipinfo', ['-1', zipPath], { encoding: 'utf8' })
  .split('\n')
  .map(function (line) {
    return line.trim()
  })
  .filter(Boolean)

const forbidden = listing.filter(function (entry) {
  return (
    entry.startsWith('tests/') ||
    entry.startsWith('node_modules/') ||
    entry.startsWith('.git/') ||
    /^STEP-.*\.md$/.test(entry) ||
    entry === 'TODO-v1.6.md' ||
    entry.startsWith('scripts/') ||
    entry.startsWith('dist/')
  )
})
if (forbidden.length) {
  console.error(JSON.stringify({ ok: false, forbidden: forbidden }))
  process.exit(1)
}

const required = ['manifest.json', 'PRIVACY.md', 'README.md', 'content/dynamic-collect.js', 'shared/constants.js']
const absent = required.filter(function (item) {
  return listing.indexOf(item) === -1
})
if (absent.length) {
  console.error(JSON.stringify({ ok: false, absent: absent, listing: listing.slice(0, 40) }))
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, zip: path.relative(root, zipPath), files: listing.length, version: version }))
