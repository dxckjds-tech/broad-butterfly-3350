;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const store = {}

  function key(provider, model) {
    return String(provider || '') + '::' + String(model || '')
  }

  function empty() {
    return {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      avgLatencyMs: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
    }
  }

  function get(provider, model) {
    const current = store[key(provider, model)]
    return Object.assign(empty(), current || {})
  }

  function write(provider, model, next) {
    store[key(provider, model)] = next
    return next
  }

  function blendLatency(prev, latencyMs, count) {
    const sample = Number(latencyMs) || 0
    if (!count) return sample
    return Math.round((prev * (count - 1) + sample) / count)
  }

  function recordSuccess(provider, model, latencyMs) {
    const prev = get(provider, model)
    const successCount = prev.successCount + 1
    return write(provider, model, {
      successCount: successCount,
      failureCount: prev.failureCount,
      consecutiveFailures: 0,
      avgLatencyMs: blendLatency(prev.avgLatencyMs, latencyMs, successCount + prev.failureCount),
      lastSuccessAt: Date.now(),
      lastFailureAt: prev.lastFailureAt,
    })
  }

  function recordFailure(provider, model, latencyMs) {
    const prev = get(provider, model)
    const failureCount = prev.failureCount + 1
    return write(provider, model, {
      successCount: prev.successCount,
      failureCount: failureCount,
      consecutiveFailures: prev.consecutiveFailures + 1,
      avgLatencyMs: blendLatency(prev.avgLatencyMs, latencyMs, prev.successCount + failureCount),
      lastSuccessAt: prev.lastSuccessAt,
      lastFailureAt: Date.now(),
    })
  }

  function temporaryPenalty(health) {
    const item = health || empty()
    if (item.consecutiveFailures >= 3) return 25
    return 0
  }

  function isCircuitOpen(health) {
    return !!(health && health.consecutiveFailures >= 8)
  }

  function reset(provider, model) {
    if (provider) delete store[key(provider, model)]
    else Object.keys(store).forEach(function (id) {
      delete store[id]
    })
  }

  ns.bg.modelHealth = {
    get: get,
    recordSuccess: recordSuccess,
    recordFailure: recordFailure,
    temporaryPenalty: temporaryPenalty,
    isCircuitOpen: isCircuitOpen,
    reset: reset,
    _store: store,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
