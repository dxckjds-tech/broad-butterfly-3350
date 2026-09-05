;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function emptyConfig(id) {
    const meta = ns.providerRegistry && ns.providerRegistry.get(id)
    return {
      enabled: false,
      participateInAuto: true,
      apiKey: '',
      baseUrl: meta ? meta.defaultBaseUrl : '',
      model: meta ? meta.defaultModel : '',
      displayName: '',
      thinking: id === 'deepseek' ? 'disabled' : '',
      capabilitiesOverride: null,
    }
  }

  function cloneConfigs(incoming) {
    const configs = {}
    const list = ns.providerRegistry ? ns.providerRegistry.list() : []
    list.forEach(function (meta) {
      configs[meta.id] = Object.assign(emptyConfig(meta.id), (incoming && incoming[meta.id]) || {})
    })
    return configs
  }

  function migrate(saved) {
    const source = saved || {}
    const incoming = source.providerConfigs && typeof source.providerConfigs === 'object' ? source.providerConfigs : {}
    const configs = cloneConfigs(incoming.configs)
    const dsKey = source.deepseekApiKey || source.apiKey || ''
    if (dsKey && !configs.deepseek.apiKey) {
      configs.deepseek.apiKey = dsKey
      configs.deepseek.enabled = true
      configs.deepseek.baseUrl = source.deepseekBaseUrl || source.baseUrl || configs.deepseek.baseUrl
      configs.deepseek.model = source.deepseekModel || source.model || configs.deepseek.model
      configs.deepseek.thinking = source.deepseekThinking || source.thinking || configs.deepseek.thinking
    }
    const kmKey = source.kimiApiKey || ''
    if (kmKey && !configs.moonshot.apiKey) {
      configs.moonshot.apiKey = kmKey
      configs.moonshot.enabled = true
      configs.moonshot.baseUrl = source.kimiBaseUrl || configs.moonshot.baseUrl
      configs.moonshot.model = source.kimiModel || configs.moonshot.model
    }
    const active = ns.providerRegistry ? ns.providerRegistry.canonicalId(source.provider || 'deepseek') : source.provider
    if (active && configs[active] && configs[active].apiKey) configs[active].enabled = true
    return {
      activeMode: incoming.activeMode || 'auto',
      costPreference: incoming.costPreference || 'balanced',
      fixed: incoming.fixed || { provider: active || 'deepseek', model: '' },
      advanced: incoming.advanced || {
        product_diagnosis: { provider: '', model: '' },
        vision_analysis: { provider: '', model: '' },
        translation: { provider: '', model: '' },
        content: { provider: '', model: '' },
      },
      orchestrationMode: incoming.orchestrationMode === 'single' || incoming.orchestrationMode === 'multi' ? incoming.orchestrationMode : 'auto',
      collaborationMode: incoming.collaborationMode || 'auto',
      roleAssignments: incoming.roleAssignments || (ASD.collaborationConfig && ASD.collaborationConfig.defaultAssignments ? ASD.collaborationConfig.defaultAssignments() : {}),
      singleModel: incoming.singleModel || { provider: '', model: '' },
      failurePolicy: incoming.failurePolicy || '',
      allowTemporaryAuto: incoming.allowTemporaryAuto === true,
      continueTextMode: incoming.continueTextMode === true,
      configs: configs,
    }
  }

  function syncLegacy(bundle, saved) {
    const src = saved || {}
    const ds = (bundle && bundle.configs && bundle.configs.deepseek) || {}
    const km = (bundle && bundle.configs && bundle.configs.moonshot) || {}
    const active = src.provider || (bundle && bundle.fixed && bundle.fixed.provider) || 'deepseek'
    return {
      provider: active === 'moonshot' ? 'kimi' : active,
      deepseekApiKey: ds.apiKey || src.deepseekApiKey || src.apiKey || '',
      deepseekBaseUrl: ds.baseUrl || src.deepseekBaseUrl || '',
      deepseekModel: ds.model || src.deepseekModel || '',
      deepseekThinking: ds.thinking || src.deepseekThinking || 'disabled',
      kimiApiKey: km.apiKey || src.kimiApiKey || '',
      kimiBaseUrl: km.baseUrl || src.kimiBaseUrl || '',
      kimiModel: km.model || src.kimiModel || '',
    }
  }

  function getConfig(bundle, id) {
    const canon = ns.providerRegistry ? ns.providerRegistry.canonicalId(id) : id
    if (bundle && bundle.configs && bundle.configs[canon]) return bundle.configs[canon]
    return emptyConfig(canon)
  }

  function hasKey(slot) {
    return !!(slot && String(slot.apiKey || '').trim())
  }

  function listConfigured(bundle) {
    const out = []
    const configs = (bundle && bundle.configs) || {}
    Object.keys(configs).forEach(function (id) {
      if (hasKey(configs[id])) out.push(id)
    })
    return out
  }

  ns.providerConfigs = {
    emptyConfig: emptyConfig,
    migrate: migrate,
    syncLegacy: syncLegacy,
    getConfig: getConfig,
    hasKey: hasKey,
    listConfigured: listConfigured,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
