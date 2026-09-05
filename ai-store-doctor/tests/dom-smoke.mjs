#!/usr/bin/env node
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://sample.made-in-china.com/',
  runScripts: 'outside-only',
})
dom.window.eval(fs.readFileSync(path.join(root, 'shared/dom.js'), 'utf8'))
if (!dom.window.ASD?.dom) throw new Error('ASD.dom missing after eval')
const { el, frag } = dom.window.ASD.dom

const node = el('div', { class: 'card', text: '<script>alert(1)</script>' }, el('span', { text: 'safe' }))
if (node.getAttribute('class') !== 'card') throw new Error('class attr failed')
if (node.childNodes[0].textContent !== '<script>alert(1)</script>') throw new Error('text must not execute HTML')
if (node.querySelector('script')) throw new Error('script child must not be created from text')
const f = frag(el('p', { text: 'a' }), 'b')
if (f.childNodes.length !== 2) throw new Error('frag children failed')
console.log(JSON.stringify({ ok: true, textContent: node.childNodes[0].textContent }))
