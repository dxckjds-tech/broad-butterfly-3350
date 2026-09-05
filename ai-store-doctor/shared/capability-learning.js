;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function explicitOnly(error) {
    const msg = (error && error.message) || ''
    const code = error && error.code
    if (code && code !== 'PARAM_REJECTED') return null
    if (!ns.responseNormalize || typeof ns.responseNormalize.isParamRejectedMessage !== 'function') return null
    if (!ns.responseNormalize.isParamRejectedMessage(msg) && code !== 'PARAM_REJECTED') return null
    return ns.responseNormalize.learnableTemperature(msg)
  }

  function mergeOverride(current, learned) {
    const next = Object.assign({}, current || {})
    if (learned && learned.temperature) next.temperature = learned.temperature
    return next
  }

  function applyLearned(caps, learned) {
    if (!caps || !learned) return caps
    const next = Object.assign({}, caps)
    if (learned.temperature) next.temperature = learned.temperature
    return next
  }

  async function persistOverride(provider, model, learned) {
    if (!learned || !chrome || !chrome.storage || !chrome.storage.local) return null
    const saved = await chrome.storage.local.get(['providerConfigs'])
    const bundle = saved.providerConfigs && typeof saved.providerConfigs === 'object' ? saved.providerConfigs : { configs: {} }
    const id = ns.providerRegistry ? ns.providerRegistry.canonicalId(provider) : provider
    const slot = (bundle.configs && bundle.configs[id]) || {}
    const current = slot.capabilitiesOverride || {}
    const temperature = learned.temperature || learned
    slot.capabilitiesOverride = mergeOverride(current, { temperature: temperature })
    if (model) {
      slot.modelCapabilityOverrides = slot.modelCapabilityOverrides || {}
      slot.modelCapabilityOverrides[model] = mergeOverride(slot.modelCapabilityOverrides[model], { temperature: temperature })
    }
    bundle.configs = bundle.configs || {}
    bundle.configs[id] = slot
    await chrome.storage.local.set({ providerConfigs: bundle })
    if (ns.bg && ns.bg.settings && typeof ns.bg.settings.invalidate === 'function') ns.bg.settings.invalidate()
    return slot.capabilitiesOverride
  }

  async function learnFromError(provider, model, error) {
    const learned = explicitOnly(error)
    if (!learned) return null
    const override = { temperature: learned }
    try {
      await persistOverride(provider, model, override)
    } catch (e) {
      /* storage optional in tests */
    }
    return override
  }

  ns.capabilityLearning = {
    explicitOnly: explicitOnly,
    applyLearned: applyLearned,
    persistOverride: persistOverride,
    learnFromError: learnFromError,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
