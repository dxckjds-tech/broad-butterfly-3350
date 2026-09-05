;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const SAFE_DEFAULTS = {
    text: true,
    vision: false,
    reasoning: false,
    structuredOutput: true,
    longContext: false,
    translation: true,
  }

  const KNOWN = {
    'deepseek-v4-flash': {
      text: true,
      vision: false,
      reasoning: true,
      structuredOutput: true,
      longContext: false,
      translation: true,
    },
    'deepseek-v4-pro': {
      text: true,
      vision: false,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'deepseek-v4-flash-vision-exp': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: false,
      translation: true,
    },
    'kimi-k2.5': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'kimi-k3': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'gpt-4o': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'gpt-4o-mini': {
      text: true,
      vision: true,
      reasoning: false,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'gpt-4.1': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'claude-sonnet-4-20250514': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'claude-3-5-sonnet-latest': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'gemini-2.0-flash': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'gemini-1.5-pro': {
      text: true,
      vision: true,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'qwen-plus': {
      text: true,
      vision: false,
      reasoning: true,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
    'qwen-vl-plus': {
      text: true,
      vision: true,
      reasoning: false,
      structuredOutput: true,
      longContext: true,
      translation: true,
    },
  }

  const DEFAULT_SCORES = {
    deepseek: {
      quality: { reasoning: 82, writing: 78, vision: 40, translation: 80, jsonReliability: 86 },
      reliability: 84,
      speed: 88,
      cost: 90,
    },
    moonshot: {
      quality: { reasoning: 84, writing: 82, vision: 86, translation: 83, jsonReliability: 80 },
      reliability: 80,
      speed: 72,
      cost: 70,
    },
    openai: {
      quality: { reasoning: 88, writing: 90, vision: 90, translation: 88, jsonReliability: 90 },
      reliability: 88,
      speed: 80,
      cost: 55,
    },
    anthropic: {
      quality: { reasoning: 92, writing: 93, vision: 86, translation: 86, jsonReliability: 88 },
      reliability: 86,
      speed: 74,
      cost: 45,
    },
    gemini: {
      quality: { reasoning: 84, writing: 80, vision: 88, translation: 84, jsonReliability: 82 },
      reliability: 80,
      speed: 86,
      cost: 78,
    },
    qwen: {
      quality: { reasoning: 80, writing: 82, vision: 78, translation: 88, jsonReliability: 82 },
      reliability: 78,
      speed: 84,
      cost: 88,
    },
    custom: {
      quality: { reasoning: 70, writing: 70, vision: 60, translation: 70, jsonReliability: 70 },
      reliability: 70,
      speed: 70,
      cost: 75,
    },
  }

  function heuristic(model) {
    const name = String(model || '').toLowerCase()
    const guess = {}
    if (/vision|vl|gpt-4o|gpt-4\.1|claude|gemini|kimi-k2\.5|kimi-k3/.test(name)) guess.vision = true
    if (/reason|r1|k3|pro|sonnet|opus/.test(name)) guess.reasoning = true
    if (/128k|256k|long|pro/.test(name)) guess.longContext = true
    return guess
  }

  function resolve(providerId, modelId, userOverride, providerCaps) {
    const canon = ns.providerRegistry ? ns.providerRegistry.canonicalId(providerId) : providerId
    const meta = ns.providerRegistry ? ns.providerRegistry.get(canon) : null
    const known = KNOWN[modelId] || KNOWN[String(modelId || '').toLowerCase()]
    const merged = Object.assign(
      {},
      SAFE_DEFAULTS,
      (meta && meta.capabilities) || {},
      providerCaps || {},
      heuristic(modelId),
      known || {},
      userOverride || {},
    )
    if (!known && !userOverride) {
      if (merged.vision == null) merged.vision = false
      if (merged.reasoning == null) merged.reasoning = false
    }
    merged.text = merged.text !== false
    if (!known && !userOverride && !providerCaps) {
      if (!/vision|vl|gpt-4o|claude|gemini|kimi-k2\.5|kimi-k3/i.test(String(modelId || ''))) merged.vision = false
    }
    return merged
  }

  function scoresFor(providerId, modelId, overrides) {
    const canon = ns.providerRegistry ? ns.providerRegistry.canonicalId(providerId) : providerId
    const base = DEFAULT_SCORES[canon] || DEFAULT_SCORES.custom
    return Object.assign({ provider: canon, model: modelId || '' }, JSON.parse(JSON.stringify(base)), overrides || {})
  }

  function hasRequired(caps, required) {
    const need = required || {}
    return Object.keys(need).every(function (key) {
      if (!need[key]) return true
      return !!(caps && caps[key])
    })
  }

  ns.modelCapabilities = {
    SAFE_DEFAULTS: SAFE_DEFAULTS,
    KNOWN: KNOWN,
    DEFAULT_SCORES: DEFAULT_SCORES,
    resolve: resolve,
    scoresFor: scoresFor,
    hasRequired: hasRequired,
    heuristic: heuristic,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
