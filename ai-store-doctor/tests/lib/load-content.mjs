import fs from 'node:fs'
import path from 'node:path'

export const CONTENT_SCRIPTS = [
  'shared/constants.js',
  'shared/product-fields.js',
  'shared/pii-patterns.js',
  'shared/sanitize.js',
  'shared/image-score.js',
  'content/dom-read.js',
  'content/field-map.js',
  'content/extractors.js',
  'content-script.js',
]

export function loadContentScripts(window, root) {
  for (const rel of CONTENT_SCRIPTS) {
    window.eval(fs.readFileSync(path.join(root, rel), 'utf8'))
  }
}

export function mockChrome(window) {
  window.chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
    },
  }
}
