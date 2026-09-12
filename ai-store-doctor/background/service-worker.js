importScripts(
  '../shared/constants.js',
  '../shared/error-codes.js',
  '../shared/response-normalize.js',
  '../shared/capability-learning.js',
  '../shared/field-provenance.js',
  '../shared/collaboration-config.js',
  '../shared/payload-compactor.js',
  '../shared/product-fields.js',
  '../shared/storage-keys.js',
  '../shared/pii-patterns.js',
  '../shared/sanitize.js',
  '../shared/result-schema.js',
  '../shared/orchestration-schemas.js',
  '../shared/task-types.js',
  '../shared/task-validators.js',
  '../shared/provider-registry.js',
  '../shared/provider-configs.js',
  '../shared/model-capabilities.js',
  '../shared/task-profiles.js',
  '../shared/model-pricing.js',
  '../shared/image-score.js',
  './settings.js',
  './providers/openai-compatible.js',
  './providers/anthropic.js',
  './providers/gemini.js',
  './provider-manager.js',
  './model-health.js',
  './execution-budget.js',
  './token-accounting.js',
  './failover-policy.js',
  './model-router.js',
  './collaboration-scheduler.js',
  './fusion-engine.js',
  './orchestration-planner.js',
  './prompt-builder.js',
  './prompts/shared-fragments.js',
  './prompts/evidence-prompt.js',
  './prompts/diagnosis-prompt.js',
  './prompts/content-prompt.js',
  './prompts/verification-prompt.js',
  './verification-risk.js',
  './final-report-guard.js',
  './orchestrator.js',
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
