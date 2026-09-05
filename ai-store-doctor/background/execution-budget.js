;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const PRESETS = {
    economy: {
      mode: 'economy',
      maxCalls: 2,
      maxDurationMs: 25000,
      maxInputTokens: 80000,
      maxOutputTokens: 16000,
      maxEstimatedCostUsd: 0.08,
      reserveVerifier: false,
    },
    balanced: {
      mode: 'balanced',
      maxCalls: 4,
      maxDurationMs: 40000,
      maxInputTokens: 120000,
      maxOutputTokens: 24000,
      maxEstimatedCostUsd: 0.35,
      reserveVerifier: true,
    },
    quality: {
      mode: 'quality',
      maxCalls: 4,
      maxDurationMs: 50000,
      maxInputTokens: 160000,
      maxOutputTokens: 32000,
      maxEstimatedCostUsd: 0.8,
      reserveVerifier: true,
    },
  }

  const STAGE_TIMEOUT_MS = {
    evidence: 15000,
    diagnosis: 20000,
    content: 20000,
    verification: 15000,
    product_diagnosis: 25000,
  }

  function preset(mode) {
    return Object.assign({}, PRESETS[mode] || PRESETS.balanced)
  }

  function create(opts) {
    const options = opts || {}
    const base = preset(options.mode || options.costPreference || 'balanced')
    if (options.orchestrationMode === 'single') {
      base.maxCalls = Math.min(base.maxCalls, 2)
      base.reserveVerifier = false
    }
    if (options.maxCalls != null) base.maxCalls = options.maxCalls
    if (options.maxDurationMs != null) base.maxDurationMs = options.maxDurationMs
    if (options.maxEstimatedCostUsd != null) base.maxEstimatedCostUsd = options.maxEstimatedCostUsd
    const startedAt = Date.now()
    return {
      mode: base.mode,
      maxCalls: base.maxCalls,
      maxDurationMs: base.maxDurationMs,
      maxInputTokens: base.maxInputTokens,
      maxOutputTokens: base.maxOutputTokens,
      maxEstimatedCostUsd: base.maxEstimatedCostUsd,
      reserveVerifier: !!base.reserveVerifier,
      usedCalls: 0,
      elapsedMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      costKnown: true,
      costEstimated: false,
      startedAt: startedAt,
      snapshot: function snapshot() {
        this.elapsedMs = Date.now() - startedAt
        return {
          mode: this.mode,
          maxCalls: this.maxCalls,
          maxDurationMs: this.maxDurationMs,
          maxInputTokens: this.maxInputTokens,
          maxOutputTokens: this.maxOutputTokens,
          maxEstimatedCostUsd: this.maxEstimatedCostUsd,
          usedCalls: this.usedCalls,
          elapsedMs: this.elapsedMs,
          inputTokens: this.inputTokens,
          outputTokens: this.outputTokens,
          estimatedCostUsd: this.estimatedCostUsd,
          costKnown: this.costKnown,
          costEstimated: this.costEstimated,
          reserveVerifier: this.reserveVerifier,
        }
      },
      remainingCalls: function remainingCalls(opts) {
        const keep = opts && opts.keepVerifier && this.reserveVerifier ? 1 : 0
        return Math.max(0, this.maxCalls - this.usedCalls - keep)
      },
      remainingMs: function remainingMs() {
        return Math.max(0, this.maxDurationMs - (Date.now() - startedAt))
      },
      stageTimeout: function stageTimeout(stage) {
        const soft = STAGE_TIMEOUT_MS[stage] || 20000
        return Math.min(soft, Math.max(1000, this.remainingMs()))
      },
      canCall: function canCall(opts) {
        if (this.usedCalls >= this.maxCalls) return false
        if (this.remainingMs() <= 0) return false
        if (opts && opts.verifier && !this.reserveVerifier && this.mode === 'economy') return false
        return true
      },
      consumeCall: function consumeCall() {
        if (this.usedCalls >= this.maxCalls) {
          const error = new Error('BUDGET_EXCEEDED')
          error.code = 'BUDGET_EXCEEDED'
          throw error
        }
        this.usedCalls += 1
        this.elapsedMs = Date.now() - startedAt
        return this.usedCalls
      },
      addUsage: function addUsage(usage, cost) {
        const u = usage || {}
        this.inputTokens += Number(u.inputTokens) || 0
        this.outputTokens += Number(u.outputTokens) || 0
        if (cost) {
          if (cost.costKnown === false) this.costKnown = false
          if (cost.costEstimated) this.costEstimated = true
          this.estimatedCostUsd += Number(cost.estimatedCostUsd) || 0
        }
        if (this.costKnown && this.estimatedCostUsd > this.maxEstimatedCostUsd) {
          const error = new Error('COST_BUDGET_EXCEEDED')
          error.code = 'COST_BUDGET_EXCEEDED'
          throw error
        }
      },
    }
  }

  ns.bg.executionBudget = {
    PRESETS: PRESETS,
    STAGE_TIMEOUT_MS: STAGE_TIMEOUT_MS,
    preset: preset,
    create: create,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
