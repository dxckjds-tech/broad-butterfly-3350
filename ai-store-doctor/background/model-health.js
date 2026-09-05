;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const store = {}
  const providerFlags = {}
  const DISABLE_MS = 5 * 60 * 1000
  const RATE_LIMIT_MS = 15 * 1000

  function key(provider, model) {
    return String(provider || '') + '::' + String(model || '')
  }

  function empty() {
    return {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      avgLatencyMs: 0,
      rateLimitCount: 0,
      timeoutCount: 0,
      schemaFailureCount: 0,
      lastErrorType: '',
      lastSuccessAt: 0,
      lastFailureAt: 0,
      disabledUntil: 0,
      needsAttention: false,
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

  function markProviderAttention(provider, on) {
    if (!provider) return
    providerFlags[String(provider)] = !!on
  }

  function providerNeedsAttention(provider) {
    return !!providerFlags[String(provider || '')]
  }

  function recordSuccess(provider, model, latencyMs) {
    const prev = get(provider, model)
    const successCount = prev.successCount + 1
    markProviderAttention(provider, false)
    return write(provider, model, {
      successCount: successCount,
      failureCount: prev.failureCount,
      consecutiveFailures: 0,
      avgLatencyMs: blendLatency(prev.avgLatencyMs, latencyMs, successCount + prev.failureCount),
      rateLimitCount: prev.rateLimitCount,
      timeoutCount: prev.timeoutCount,
      schemaFailureCount: prev.schemaFailureCount,
      lastErrorType: '',
      lastSuccessAt: Date.now(),
      lastFailureAt: prev.lastFailureAt,
      disabledUntil: 0,
      needsAttention: false,
    })
  }

  function recordFailure(provider, model, latencyMs, errorType, extras) {
    const prev = get(provider, model)
    const failureCount = prev.failureCount + 1
    const consecutiveFailures = prev.consecutiveFailures + 1
    const code = String(errorType || '')
    const extra = extras || {}
    let disabledUntil = prev.disabledUntil || 0
    let needsAttention = !!prev.needsAttention
    let rateLimitCount = prev.rateLimitCount || 0
    let timeoutCount = prev.timeoutCount || 0
    let schemaFailureCount = prev.schemaFailureCount || 0

    if (code === 'AUTH_ERROR') {
      needsAttention = true
      markProviderAttention(provider, true)
    }
    if (code === 'RATE_LIMIT_ERROR') {
      rateLimitCount += 1
      const retryMs = Number(extra.retryAfterMs) || RATE_LIMIT_MS
      disabledUntil = Math.max(disabledUntil, Date.now() + retryMs)
    }
    if (code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === 'CONNECTION_ERROR') {
      timeoutCount += 1
    }
    if (code === 'SCHEMA_ERROR') schemaFailureCount += 1
    if (consecutiveFailures >= 5) {
      disabledUntil = Math.max(disabledUntil, Date.now() + DISABLE_MS)
    }

    return write(provider, model, {
      successCount: prev.successCount,
      failureCount: failureCount,
      consecutiveFailures: consecutiveFailures,
      avgLatencyMs: blendLatency(prev.avgLatencyMs, latencyMs, prev.successCount + failureCount),
      rateLimitCount: rateLimitCount,
      timeoutCount: timeoutCount,
      schemaFailureCount: schemaFailureCount,
      lastErrorType: code,
      lastSuccessAt: prev.lastSuccessAt,
      lastFailureAt: Date.now(),
      disabledUntil: disabledUntil,
      needsAttention: needsAttention,
    })
  }

  function temporaryPenalty(health) {
    const item = health || empty()
    if (item.disabledUntil && Date.now() < item.disabledUntil) return 40
    if (item.consecutiveFailures >= 3) return 25
    return 0
  }

  function isCircuitOpen(health) {
    if (health && health.disabledUntil && Date.now() < health.disabledUntil) return true
    return !!(health && health.consecutiveFailures >= 8)
  }

  function isRoutable(provider, model, opts) {
    const auto = !opts || opts.auto !== false
    if (auto && providerNeedsAttention(provider)) return false
    const health = get(provider, model)
    if (auto && health.needsAttention) return false
    if (health.disabledUntil && Date.now() < health.disabledUntil) return false
    return !isCircuitOpen(health)
  }

  function clearAttention(provider, model) {
    markProviderAttention(provider, false)
    if (model) {
      const prev = get(provider, model)
      return write(provider, model, Object.assign({}, prev, { needsAttention: false, disabledUntil: 0, consecutiveFailures: 0 }))
    }
    Object.keys(store).forEach(function (id) {
      if (id.indexOf(String(provider) + '::') === 0) {
        store[id] = Object.assign({}, store[id], { needsAttention: false, disabledUntil: 0, consecutiveFailures: 0 })
      }
    })
    return true
  }

  function reset(provider, model) {
    if (provider && model) delete store[key(provider, model)]
    else if (provider) {
      Object.keys(store).forEach(function (id) {
        if (id.indexOf(String(provider) + '::') === 0) delete store[id]
      })
      delete providerFlags[String(provider)]
    } else {
      Object.keys(store).forEach(function (id) {
        delete store[id]
      })
      Object.keys(providerFlags).forEach(function (id) {
        delete providerFlags[id]
      })
    }
  }

  ns.bg.modelHealth = {
    get: get,
    recordSuccess: recordSuccess,
    recordFailure: recordFailure,
    temporaryPenalty: temporaryPenalty,
    isCircuitOpen: isCircuitOpen,
    isRoutable: isRoutable,
    clearAttention: clearAttention,
    providerNeedsAttention: providerNeedsAttention,
    reset: reset,
    _store: store,
    _providerFlags: providerFlags,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
