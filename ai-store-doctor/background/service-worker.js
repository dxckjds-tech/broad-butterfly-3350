importScripts(
  '../shared/constants.js',
  '../shared/product-fields.js',
  '../shared/storage-keys.js',
  '../shared/pii-patterns.js',
  '../shared/sanitize.js',
  '../shared/result-schema.js',
  '../shared/task-types.js',
  '../shared/task-validators.js',
  '../shared/image-score.js',
  './settings.js',
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
