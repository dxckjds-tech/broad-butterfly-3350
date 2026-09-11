;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  let cache = null

  function isSettingsKey(key) {
    return ASD.storageKeys.SETTINGS.indexOf(key) !== -1
  }

  function applyLegacy(saved) {
    const next = { ...saved }
    if (next.apiKey && !next.deepseekApiKey) next.deepseekApiKey = next.apiKey
    return next
  }

  async function load() {
    if (cache) return cache
    const saved = await chrome.storage.local.get(ASD.storageKeys.SETTINGS)
    cache = { ...ASD.constants.DEFAULTS, ...applyLegacy(saved) }
    return cache
  }

  function invalidate() {
    cache = null
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    for (const key of Object.keys(changes)) {
      if (isSettingsKey(key)) {
        cache = null
        return
      }
    }
  })

  ns.bg.settings = { load, invalidate }
})(typeof globalThis !== 'undefined' ? globalThis : self)
