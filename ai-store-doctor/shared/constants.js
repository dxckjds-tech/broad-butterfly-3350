;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const SUPPORTED_HOST_SUFFIXES = ['made-in-china.com', 'vemic.com']

  const DEFAULTS = {
    provider: 'deepseek',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-v4-flash',
    deepseekThinking: 'disabled',
    kimiBaseUrl: 'https://api.moonshot.cn/v1',
    kimiModel: 'kimi-k2.5',
  }

  ns.constants = {
    EXTENSION_VERSION: '1.6.3',
    PROMPT_VERSION: '1.6.0',
    SCHEMA_VERSION: '1',
    MAX_ORCHESTRATION_CALLS: 3,
    SUPPORTED_HOST_SUFFIXES,
    DEFAULTS,
    DEEPSEEK_CHAT_PATH: '/chat/completions',
    HISTORY_MAX: 100,
    isSupportedHost: function isSupportedHost(hostname) {
      const host = String(hostname || '').toLowerCase()
      return SUPPORTED_HOST_SUFFIXES.some(function (suffix) {
        return host === suffix || host.endsWith('.' + suffix)
      })
    },
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
