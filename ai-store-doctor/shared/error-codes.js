;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const CODES = {
    AUTH_ERROR: 'AUTH_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    UNSUPPORTED_CAPABILITY: 'UNSUPPORTED_CAPABILITY',
    TIMEOUT: 'TIMEOUT',
    LENGTH_ERROR: 'LENGTH_ERROR',
    RESPONSE_ERROR: 'RESPONSE_ERROR',
    SCHEMA_ERROR: 'SCHEMA_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    EVIDENCE_CONFLICT: 'EVIDENCE_CONFLICT',
    BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
    COST_BUDGET_EXCEEDED: 'COST_BUDGET_EXCEEDED',
    PROVIDER_ERROR: 'PROVIDER_ERROR',
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    ORCHESTRATION_BUDGET_EXCEEDED: 'ORCHESTRATION_BUDGET_EXCEEDED',
  }

  const ALIASES = {
    CONNECTION_ERROR: 'NETWORK_ERROR',
    ORCHESTRATION_BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
    NETWORK_ERROR: 'NETWORK_ERROR',
  }

  function normalize(code) {
    const raw = String(code || '')
    if (ALIASES[raw]) return ALIASES[raw] === raw ? raw : ALIASES[raw]
    if (CODES[raw]) return raw
    return raw || 'PROVIDER_ERROR'
  }

  function is(code, expected) {
    const a = normalize(code)
    const b = normalize(expected)
    if (a === b) return true
    if (code === expected) return true
    if (expected === 'NETWORK_ERROR' && (code === 'CONNECTION_ERROR' || code === 'TIMEOUT')) return true
    if (expected === 'BUDGET_EXCEEDED' && code === 'ORCHESTRATION_BUDGET_EXCEEDED') return true
    return false
  }

  ns.errorCodes = {
    CODES: CODES,
    ALIASES: ALIASES,
    normalize: normalize,
    is: is,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
