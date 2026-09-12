;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}

  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>'"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c],
    )
  const badge = (s) => `<span class="badge badge-${String(s || 'unknown').toLowerCase()}">${esc(s || 'UNKNOWN')}</span>`
  const arr = (v) => (Array.isArray(v) ? v : [])
  const translateButton = (text) =>
    text
      ? `<button class="translate-btn" data-action="translate" data-text="${encodeURIComponent(String(text))}">翻译</button>`
      : ''

  ns.sidepanel.ui = { esc, badge, arr, translateButton }
})(typeof globalThis !== 'undefined' ? globalThis : self)
