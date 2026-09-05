;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function adapterFor(id) {
    const meta = ASD.providerRegistry && ASD.providerRegistry.get(id)
    const name = meta ? meta.adapter : 'openai-compatible'
    const pack = ASD.bg.providers || {}
    if (name === 'anthropic') return pack.anthropic || pack.openaiCompatible
    if (name === 'gemini') return pack.gemini || pack.openaiCompatible
    return pack.openaiCompatible
  }

  function supportsModelList(meta, slot) {
    if (slot && slot.capabilitiesOverride && slot.capabilitiesOverride.supportsModelList != null) {
      return !!slot.capabilitiesOverride.supportsModelList
    }
    return !!(meta && meta.supportsModelList)
  }

  function resolveProvider(cfg, id) {
    const source = cfg || {}
    const bundle = source.providerConfigs || (ASD.providerConfigs ? ASD.providerConfigs.migrate(source) : null)
    const hinted = id || source.provider || (bundle && bundle.fixed && bundle.fixed.provider) || 'deepseek'
    const canon = ASD.providerRegistry ? ASD.providerRegistry.canonicalId(hinted) : hinted
    const meta = ASD.providerRegistry ? ASD.providerRegistry.get(canon) : null
    const slot = ASD.providerConfigs ? ASD.providerConfigs.getConfig(bundle, canon) : {}
    const apiKey = slot.apiKey || (canon === 'moonshot' ? source.kimiApiKey : canon === 'deepseek' ? source.deepseekApiKey || source.apiKey : '')
    const baseUrl = slot.baseUrl || (meta && meta.defaultBaseUrl) || ''
    const model = slot.model || (meta && meta.defaultModel) || ''
    return {
      id: canon,
      isKimi: canon === 'moonshot',
      isK3: canon === 'moonshot' && /kimi-k3/i.test(model),
      apiKey: apiKey,
      providerName: slot.displayName || (meta && meta.name) || canon,
      baseUrl: baseUrl,
      model: model,
      adapter: adapterFor(canon),
      meta: meta,
      config: slot,
      supportsModelList: supportsModelList(meta, slot),
    }
  }

  ns.bg.providerManager = {
    adapterFor: adapterFor,
    resolveProvider: resolveProvider,
    supportsModelList: supportsModelList,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
