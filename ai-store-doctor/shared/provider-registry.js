;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function platform(extra) {
    return Object.assign(
      {
        mayOfferVision: false,
        mayOfferReasoning: false,
        mayOfferLongContext: false,
        mayOfferStructuredOutput: false,
      },
      extra || {},
    )
  }

  const PROVIDERS = [
    {
      id: 'deepseek',
      aliases: ['deepseek'],
      name: 'DeepSeek',
      apiStyle: 'openai-compatible',
      defaultBaseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-v4-flash',
      supportsModelList: true,
      platformCapabilities: platform({ mayOfferReasoning: true, mayOfferStructuredOutput: true }),
      adapter: 'openai-compatible',
      host: 'api.deepseek.com',
    },
    {
      id: 'moonshot',
      aliases: ['kimi', 'moonshot'],
      name: 'Kimi / Moonshot',
      apiStyle: 'openai-compatible',
      defaultBaseUrl: 'https://api.moonshot.cn/v1',
      defaultModel: 'kimi-k2.5',
      supportsModelList: true,
      platformCapabilities: platform({
        mayOfferVision: true,
        mayOfferReasoning: true,
        mayOfferLongContext: true,
        mayOfferStructuredOutput: true,
      }),
      adapter: 'openai-compatible',
      host: 'api.moonshot.cn',
    },
    {
      id: 'openai',
      aliases: ['openai'],
      name: 'OpenAI',
      apiStyle: 'openai-compatible',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      supportsModelList: true,
      platformCapabilities: platform({
        mayOfferVision: true,
        mayOfferReasoning: true,
        mayOfferLongContext: true,
        mayOfferStructuredOutput: true,
      }),
      adapter: 'openai-compatible',
      host: 'api.openai.com',
    },
    {
      id: 'anthropic',
      aliases: ['claude', 'anthropic'],
      name: 'Claude / Anthropic',
      apiStyle: 'anthropic',
      defaultBaseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-sonnet-4-20250514',
      supportsModelList: true,
      platformCapabilities: platform({
        mayOfferVision: true,
        mayOfferReasoning: true,
        mayOfferLongContext: true,
      }),
      adapter: 'anthropic',
      host: 'api.anthropic.com',
    },
    {
      id: 'gemini',
      aliases: ['google', 'gemini'],
      name: 'Gemini / Google',
      apiStyle: 'gemini',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com',
      defaultModel: 'gemini-2.0-flash',
      supportsModelList: true,
      platformCapabilities: platform({
        mayOfferVision: true,
        mayOfferReasoning: true,
        mayOfferLongContext: true,
        mayOfferStructuredOutput: true,
      }),
      adapter: 'gemini',
      host: 'generativelanguage.googleapis.com',
    },
    {
      id: 'qwen',
      aliases: ['qwen', 'dashscope', 'alibaba'],
      name: 'Qwen',
      apiStyle: 'openai-compatible',
      defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen-plus',
      supportsModelList: true,
      platformCapabilities: platform({
        mayOfferVision: true,
        mayOfferReasoning: true,
        mayOfferLongContext: true,
        mayOfferStructuredOutput: true,
      }),
      adapter: 'openai-compatible',
      host: 'dashscope.aliyuncs.com',
    },
    {
      id: 'custom',
      aliases: ['custom'],
      name: 'Custom OpenAI-Compatible',
      apiStyle: 'openai-compatible',
      defaultBaseUrl: '',
      defaultModel: '',
      supportsModelList: false,
      platformCapabilities: platform(),
      adapter: 'openai-compatible',
      host: '',
      userDeclaredCapabilities: true,
    },
  ]

  function list() {
    return PROVIDERS.slice()
  }

  function get(id) {
    const key = String(id || '').toLowerCase()
    if (!key) return null
    for (let i = 0; i < PROVIDERS.length; i += 1) {
      const item = PROVIDERS[i]
      if (item.id === key) return item
      if (item.aliases && item.aliases.indexOf(key) !== -1) return item
    }
    return null
  }

  function canonicalId(id) {
    const item = get(id)
    return item ? item.id : String(id || '')
  }

  function openaiCompatibleIds() {
    return PROVIDERS.filter(function (item) {
      return item.apiStyle === 'openai-compatible'
    }).map(function (item) {
      return item.id
    })
  }

  ns.providerRegistry = {
    PROVIDERS: PROVIDERS,
    list: list,
    get: get,
    canonicalId: canonicalId,
    openaiCompatibleIds: openaiCompatibleIds,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
