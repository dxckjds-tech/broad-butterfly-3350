;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function resolve(cfg) {
    if (ASD.bg.providerManager && typeof ASD.bg.providerManager.resolveProvider === 'function') {
      return ASD.bg.providerManager.resolveProvider(cfg, cfg && cfg.provider)
    }
    const isKimi = cfg.provider === 'kimi' || cfg.provider === 'moonshot'
    const apiKey = isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey
    const providerName = isKimi ? 'Kimi' : 'DeepSeek'
    const baseUrl = isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl
    const model = isKimi ? cfg.kimiModel : cfg.deepseekModel
    const isK3 = isKimi && /kimi-k3/i.test(model)
    return { isKimi, apiKey, providerName, baseUrl, model, isK3 }
  }

  function isVisionCapable(model) {
    return /kimi-k3|kimi-k2\.5|vision/i.test(model)
  }

  ns.bg.modelRouter = { resolve, isVisionCapable }
})(typeof globalThis !== 'undefined' ? globalThis : self)
