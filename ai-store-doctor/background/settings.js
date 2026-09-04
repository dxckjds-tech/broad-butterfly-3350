;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  async function load() {
    const saved = await chrome.storage.local.get(null)
    if (saved.apiKey && !saved.deepseekApiKey) saved.deepseekApiKey = saved.apiKey
    return { ...ASD.constants.DEFAULTS, ...saved }
  }

  ns.bg.settings = { load }
})(typeof globalThis !== 'undefined' ? globalThis : self)
