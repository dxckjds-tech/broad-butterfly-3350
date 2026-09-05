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
    if (options.maxInputTokens != null) base.maxInputTokens = options.maxInputTokens
    if (options.maxOutputTokens != null) base.maxOutputTokens = options.maxOutputTokens
    const startedAt = Date.now()
    const pricing = (ns.shared && ns.shared.modelPricing) || ns.modelPricing || {}
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
      costExceeded: false,
      tokenExceeded: false,
      tokenExceededKind: '',
      exhaustedReason: '',
      pricingVersion: pricing.PRICING_VERSION || '',
      sourceDate: pricing.SOURCE_DATE || '',
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
          costExceeded: this.costExceeded,
          tokenExceeded: this.tokenExceeded,
          tokenExceededKind: this.tokenExceededKind,
          exhaustedReason: this.exhaustedReason,
          pricingVersion: this.pricingVersion,
          sourceDate: this.sourceDate,
        }
      },
      remainingCalls: function remainingCalls(opts) {
        const keep = opts && opts.keepVerifier && this.reserveVerifier ? 1 : 0
        return Math.max(0, this.maxCalls - this.usedCalls - keep)
      },
      remainingMs: function remainingMs() {
        return Math.max(0, this.maxDurationMs - (Date.now() - startedAt))
      },
      remainingInputTokens: function remainingInputTokens() {
        return Math.max(0, this.maxInputTokens - this.inputTokens)
      },
      remainingOutputTokens: function remainingOutputTokens() {
        return Math.max(0, this.maxOutputTokens - this.outputTokens)
      },
      remainingCostUsd: function remainingCostUsd() {
        if (this.costKnown === false) return null
        return Math.max(0, Number(this.maxEstimatedCostUsd) - Number(this.estimatedCostUsd || 0))
      },
      requestMaxTokens: function requestMaxTokens(stageMaxTokens) {
        const stage = Number(stageMaxTokens) > 0 ? Number(stageMaxTokens) : 4200
        return Math.min(stage, this.remainingOutputTokens())
      },
      stageTimeout: function stageTimeout(stage) {
        const soft = STAGE_TIMEOUT_MS[stage] || 20000
        return Math.min(soft, Math.max(1000, this.remainingMs()))
      },
      markCostExceeded: function markCostExceeded() {
        this.costExceeded = true
        if (!this.exhaustedReason) this.exhaustedReason = 'COST_BUDGET_EXCEEDED'
      },
      markTokenExceeded: function markTokenExceeded(kind) {
        this.tokenExceeded = true
        this.tokenExceededKind = kind || 'TOKEN_BUDGET_EXCEEDED'
        if (!this.exhaustedReason) this.exhaustedReason = this.tokenExceededKind
      },
      canCall: function canCall(opts) {
        if (this.costExceeded) return false
        if (this.tokenExceeded) return false
        if (this.usedCalls >= this.maxCalls) return false
        if (this.remainingMs() <= 0) return false
        if (this.remainingOutputTokens() <= 0) return false
        if (opts && opts.verifier && !this.reserveVerifier && this.mode === 'economy') return false
        return true
      },
      consumeCall: function consumeCall() {
        if (!this.canCall()) {
          const error = new Error(this.exhaustedReason || 'BUDGET_EXCEEDED')
          error.code = this.exhaustedReason || 'BUDGET_EXCEEDED'
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
        if (this.inputTokens > this.maxInputTokens) this.markTokenExceeded('TOKEN_INPUT_BUDGET_EXCEEDED')
        if (this.outputTokens > this.maxOutputTokens) this.markTokenExceeded('TOKEN_OUTPUT_BUDGET_EXCEEDED')
        if (this.costKnown && this.estimatedCostUsd > this.maxEstimatedCostUsd) this.markCostExceeded()
        return this.snapshot()
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
