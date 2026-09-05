;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const SETTINGS = [
    'provider',
    'deepseekApiKey',
    'deepseekBaseUrl',
    'deepseekModel',
    'deepseekThinking',
    'kimiApiKey',
    'kimiBaseUrl',
    'kimiModel',
    'apiKey',
    'baseUrl',
    'model',
    'thinking',
    'providerConfigs',
  ]

  ns.storageKeys = {
    SETTINGS,
    HIST_INDEX: 'hist:idx',
    histItem: function histItem(id) {
      return 'hist:' + id
    },
    META_SCHEMA: 'meta:schemaVersion',
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
