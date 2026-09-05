importScripts(
  '../shared/constants.js',
  '../shared/product-fields.js',
  '../shared/storage-keys.js',
  '../shared/pii-patterns.js',
  '../shared/sanitize.js',
  '../shared/result-schema.js',
  '../shared/task-types.js',
  '../shared/task-validators.js',
  '../shared/provider-registry.js',
  '../shared/provider-configs.js',
  '../shared/model-capabilities.js',
  '../shared/task-profiles.js',
  '../shared/image-score.js',
  './settings.js',
  './providers/openai-compatible.js',
  './providers/anthropic.js',
  './providers/gemini.js',
  './provider-manager.js',
  './model-health.js',
  './model-router.js',
  './prompt-builder.js',
  './payload-builder.js',
  './image-fetcher.js',
  './ai-client.js',
  './url-reader.js',
  './request-registry.js',
  './message-handler.js',
)

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Promise.resolve(ASD.bg.messageHandler.handle(message, sender))
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, reason: error.message }))
  return true
})
