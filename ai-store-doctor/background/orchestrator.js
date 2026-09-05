;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function requireSanitize() {
    if (!ASD.sanitize || typeof ASD.sanitize.sanitizePayload !== 'function') {
      const error = new Error('SECURITY_SANITIZER_UNAVAILABLE')
      error.code = 'SECURITY_SANITIZER_UNAVAILABLE'
      throw error
    }
  }

  function maxCalls() {
    return (ASD.constants && ASD.constants.MAX_ORCHESTRATION_CALLS) || 3
  }

  function displayName(id) {
    const meta = ASD.providerRegistry && ASD.providerRegistry.get(id)
    return (meta && meta.name) || id || ''
  }

  function throwBudget(code) {
    const error = new Error(code || 'ORCHESTRATION_BUDGET_EXCEEDED')
    error.code = code || 'ORCHESTRATION_BUDGET_EXCEEDED'
    error.budgetCode = code || 'BUDGET_EXCEEDED'
    throw error
  }

  function isBudgetCode(error) {
    const code = error && error.code
    return (
      code === 'ORCHESTRATION_BUDGET_EXCEEDED' ||
      code === 'BUDGET_EXCEEDED' ||
      code === 'COST_BUDGET_EXCEEDED' ||
      code === 'TOKEN_BUDGET_EXCEEDED' ||
      code === 'TOKEN_INPUT_BUDGET_EXCEEDED' ||
      code === 'TOKEN_OUTPUT_BUDGET_EXCEEDED'
    )
  }

  function laterStages(diagnosisStage, contentStage, evidenceStage) {
    const out = []
    if (diagnosisStage && diagnosisStage !== evidenceStage) out.push(diagnosisStage)
    if (contentStage && contentStage !== diagnosisStage && contentStage !== evidenceStage) out.push(contentStage)
    return out
  }

  function replanTriggerOf(budget, remainingStages, extras) {
    const extra = extras || {}
    if (budget && budget.costExceeded) return budget.exhaustedReason || 'COST_BUDGET_EXCEEDED'
    if (budget && budget.tokenExceeded) return budget.exhaustedReason || 'TOKEN_BUDGET_EXCEEDED'
    if (extra.fallbackUsed && !extra.alreadyReplannedFallback) return 'FALLBACK_USED'
    if (budget && budget.remainingMs && budget.remainingMs() < 15000) return 'LOW_REMAINING_DURATION'
    const rem = budget && budget.remainingCalls
      ? budget.remainingCalls({ keepVerifier: extra.keepVerifier })
      : budget
        ? Math.max(0, budget.maxCalls - budget.usedCalls)
        : 0
    if ((remainingStages || []).length > rem) return 'REMAINING_CALLS'
    return ''
  }

  function invokeReplan(budget, remainingStages, extras) {
    const extra = extras || {}
    const planner = ASD.bg.orchestrationPlanner
    if (!planner || typeof planner.replanAfterFailure !== 'function') return null
    const remainingCalls = budget && budget.remainingCalls
      ? budget.remainingCalls({ keepVerifier: extra.keepVerifier })
      : budget
        ? Math.max(0, budget.maxCalls - budget.usedCalls)
        : 0
    const plan = planner.replanAfterFailure({
      remainingCalls: remainingCalls,
      remainingDuration: budget && budget.remainingMs ? budget.remainingMs() : 1,
      remainingCost: budget && budget.remainingCostUsd ? budget.remainingCostUsd() : null,
      remainingStages: remainingStages || [],
      remainingInputTokens: budget && budget.remainingInputTokens ? budget.remainingInputTokens() : null,
      remainingOutputTokens: budget && budget.remainingOutputTokens ? budget.remainingOutputTokens() : null,
      costExceeded: !!(budget && budget.costExceeded),
      tokenExceeded: !!(budget && budget.tokenExceeded),
      exhaustedReason: (budget && budget.exhaustedReason) || '',
      fallbackUsed: !!extra.fallbackUsed,
      verificationRisk: extra.verificationRisk || {},
    })
    const row = {
      trigger: extra.trigger || '',
      beforeCalls: extra.beforeCalls != null ? extra.beforeCalls : remainingCalls,
      remainingCalls: remainingCalls,
      action: (plan && plan.action) || '',
      reason: plan && Array.isArray(plan.reason) ? plan.reason.join(',') : String((plan && plan.reason) || ''),
    }
    if (extra.replans) extra.replans.push(row)
    return plan
  }

  function stubDiagnosisFromEvidence(evidence) {
    const rows = ((evidence && evidence.evidence) || []).map(function (item) {
      return {
        label: item.field || item.label,
        field: item.field || item.label,
        value: item.value,
        status: item.status || 'OBSERVED',
        sourceType: item.sourceType,
        sourceRef: item.sourceRef,
        sourceStage: item.sourceStage || 'evidence',
        claimId: item.claimId,
        note: '',
        confidence: item.confidence || 0,
      }
    })
    return {
      summary: '',
      identity: {
        name: (evidence && evidence.identityCandidates && evidence.identityCandidates[0] && evidence.identityCandidates[0].name) || '',
        confidence: (evidence && evidence.identityCandidates && evidence.identityCandidates[0] && evidence.identityCandidates[0].confidence) || 0,
      },
      facts: rows,
      diagnosis: { strengths: [], issues: [], priorities: [] },
      keywordStrategy: { primary: [], secondary: [], blocked: [], rationale: [] },
      contentBrief: { titleGoals: [], detailGoals: [], faqGoals: [], geoGoals: [] },
    }
  }

  function wrapUser(text, images) {
    const nonce = ASD.bg.payloadBuilder.randomNonce()
    const wrapped = ASD.bg.payloadBuilder.wrapUntrusted(text, nonce)
    if (images && images.length) {
      return [{ type: 'text', text: wrapped }].concat(
        images.map(function (url) {
          return { type: 'image_url', image_url: { url: url } }
        }),
      )
    }
    return wrapped
  }

  function compactDiagnosis(diagnosis) {
    if (!diagnosis) return {}
    return {
      summary: diagnosis.summary,
      identity: diagnosis.identity,
      facts: (diagnosis.facts || []).map(function (item) {
        return {
          claimId: item.claimId,
          field: item.field || item.label,
          label: item.label,
          value: item.value,
          status: item.status,
          sourceType: item.sourceType,
          sourceRef: item.sourceRef,
          note: item.note,
        }
      }),
      diagnosis: diagnosis.diagnosis,
      keywordStrategy: diagnosis.keywordStrategy,
      contentBrief: diagnosis.contentBrief,
    }
  }

  function compactEvidence(evidence) {
    if (!evidence) return {}
    return {
      identityCandidates: evidence.identityCandidates,
      evidence: (evidence.evidence || []).map(function (item) {
        return {
          field: item.field,
          value: item.value,
          sourceType: item.sourceType,
          sourceRef: item.sourceRef,
          status: item.status,
          confidence: item.confidence,
        }
      }),
      imageObservations: evidence.imageObservations,
      unknowns: evidence.unknowns,
    }
  }

  function trustedPageEvidence(evidence) {
    const trusted = { product_field: true, spec_table: true, json_ld: true, explicit_page_field: true }
    return {
      evidence: ((evidence && evidence.evidence) || []).filter(function (item) {
        return item && trusted[item.sourceType]
      }),
    }
  }

  function textOnlyEvidenceFromBundle(product, fields) {
    const root = (product && product.product) || product || {}
    const specs = Array.isArray(root.specifications) ? root.specifications : []
    const evidence = specs
      .filter(function (row) {
        return row && (row.name || row.label) && row.value
      })
      .map(function (row) {
        return {
          field: String(row.name || row.label),
          value: String(row.value),
          sourceType: 'spec_table',
          sourceRef: String(row.name || row.label),
          status: 'VERIFIED',
          confidence: 80,
        }
      })
    if (root.name) {
      evidence.unshift({
        field: 'name',
        value: String(root.name),
        sourceType: 'product_field',
        sourceRef: 'product.name',
        status: 'VERIFIED',
        confidence: 90,
      })
    }
    if (fields && fields.title && !root.name) {
      evidence.unshift({
        field: 'name',
        value: String(fields.title),
        sourceType: 'product_field',
        sourceRef: 'fields.title',
        status: 'VERIFIED',
        confidence: 70,
      })
    }
    return {
      identityCandidates: root.name ? [{ name: String(root.name), confidence: 70, evidence: ['product_field'] }] : [],
      evidence: evidence,
      imageObservations: [],
      unknowns: ['vision_degraded_to_text'],
    }
  }

  function stubContentFromDiagnosis(diagnosis) {
    const identity = (diagnosis && diagnosis.identity) || {}
    const keywords = (diagnosis && diagnosis.keywordStrategy) || {}
    return {
      summary: {
        identity: identity.name || '',
        confidence: identity.confidence || 0,
        dataCompleteness: 50,
        contentReadiness: 0,
        status: 'UNKNOWN',
      },
      facts: (diagnosis && diagnosis.facts) || [],
      keywords: {
        current: keywords.primary || [],
        blocked: keywords.blocked || [],
        candidates: keywords.secondary || [],
      },
      content: {
        titles: [],
        detail: {
          headline: '',
          overview: '',
          highlights: [],
          specifications: [],
          applications: [],
          packagingDelivery: '',
          buyerNote: '',
        },
        faq: [],
        geo: {
          headline: '',
          directAnswer: '',
          productFacts: [],
          companyContext: '',
          buyerQuestions: [],
          sourcingGuidance: [],
          evidenceBasis: [],
        },
      },
      debug: { missingFields: ['content'], warnings: ['content_stage_failed'] },
    }
  }

  function normalizeUsage(raw, extras) {
    if (ASD.bg.tokenAccounting && typeof ASD.bg.tokenAccounting.normalize === 'function') {
      return ASD.bg.tokenAccounting.normalize(raw, extras)
    }
    return raw || null
  }

  function estimateCost(used, usage) {
    const pricing = (ASD.shared && ASD.shared.modelPricing) || ASD.modelPricing
    if (!pricing || !usage) return { estimatedCostUsd: null, costKnown: false, costEstimated: false }
    return pricing.estimateCostUsd({
      provider: used && used.provider,
      model: used && used.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    })
  }

  function makeBudget(opts, plan) {
    if (ASD.bg.executionBudget && typeof ASD.bg.executionBudget.create === 'function') {
      return ASD.bg.executionBudget.create({
        mode: opts.mode || opts.costPreference || 'balanced',
        orchestrationMode: plan && plan.mode,
        maxCalls: opts.maxCalls,
        maxDurationMs: opts.maxDurationMs,
        maxEstimatedCostUsd: opts.maxEstimatedCostUsd,
        maxInputTokens: opts.maxInputTokens,
        maxOutputTokens: opts.maxOutputTokens,
      })
    }
    return {
      mode: 'balanced',
      maxCalls: maxCalls(),
      usedCalls: 0,
      reserveVerifier: false,
      maxDurationMs: 40000,
      maxEstimatedCostUsd: 1,
      maxInputTokens: 200000,
      maxOutputTokens: 200000,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      costKnown: true,
      costExceeded: false,
      tokenExceeded: false,
      exhaustedReason: '',
      consumeCall: function consumeCall() {
        this.usedCalls += 1
        return this.usedCalls
      },
      canCall: function canCall() {
        if (this.costExceeded || this.tokenExceeded) return false
        return this.usedCalls < this.maxCalls
      },
      remainingCalls: function remainingCalls() {
        return Math.max(0, this.maxCalls - this.usedCalls)
      },
      remainingMs: function remainingMs() {
        return 40000
      },
      remainingInputTokens: function remainingInputTokens() {
        return Math.max(0, this.maxInputTokens - this.inputTokens)
      },
      remainingOutputTokens: function remainingOutputTokens() {
        return Math.max(0, this.maxOutputTokens - this.outputTokens)
      },
      remainingCostUsd: function remainingCostUsd() {
        return Math.max(0, this.maxEstimatedCostUsd - this.estimatedCostUsd)
      },
      requestMaxTokens: function requestMaxTokens(stageMaxTokens) {
        const stage = Number(stageMaxTokens) > 0 ? Number(stageMaxTokens) : 4200
        return Math.min(stage, this.remainingOutputTokens())
      },
      stageTimeout: function stageTimeout() {
        return 20000
      },
      markCostExceeded: function markCostExceeded() {
        this.costExceeded = true
        if (!this.exhaustedReason) this.exhaustedReason = 'COST_BUDGET_EXCEEDED'
      },
      markTokenExceeded: function markTokenExceeded(kind) {
        this.tokenExceeded = true
        if (!this.exhaustedReason) this.exhaustedReason = kind || 'TOKEN_BUDGET_EXCEEDED'
      },
      addUsage: function addUsage() {},
      snapshot: function snapshot() {
        return { usedCalls: this.usedCalls, maxCalls: this.maxCalls }
      },
    }
  }

  async function defaultExecute(opts) {
    return ASD.bg.aiClient.callAI(opts)
  }

  function userStatus(orch) {
    const calls = (orch && orch.totalCalls) || 0
    const sec = (((orch && orch.totalDurationMs) || 0) / 1000).toFixed(1)
    const lines = ['AI协同完成', calls + '次调用 · ' + sec + '秒']
    if (orch && orch.verification && orch.verification.triggered) lines.push('已对高风险事实进行二次复核')
    const down = orch && orch.verification && orch.verification.downgraded
    if (down) lines.push('发现' + down + '条证据不足内容，已自动降级')
    if (orch && orch.completion && orch.completion.status === 'partial') {
      lines.push('诊断已完成，但部分内容建议生成失败。')
    }
    return lines
  }

  function summarize(plan, stages, durationMs, totalCalls, extras) {
    const extra = extras || {}
    const orch = {
      mode: plan.mode,
      totalCalls: totalCalls,
      totalDurationMs: durationMs,
      estimatedCalls: plan.estimatedCalls,
      reason: plan.reason || [],
      textFallback: !!plan.textFallback,
      stages: stages,
      fallbackUsed: !!(extra.fallbackUsed || (stages || []).some(function (item) { return item && item.fallbackUsed })),
      budget: extra.budget || null,
      usage: extra.usage || null,
      cost: extra.cost
        ? Object.assign(
            {
              pricingVersion: extra.budget && extra.budget.pricingVersion,
              sourceDate: extra.budget && extra.budget.sourceDate,
            },
            extra.cost,
          )
        : extra.cost || null,
      verification: extra.verification || null,
      completion: extra.completion || { status: 'complete', missingStages: [], reasons: [] },
      riskScore: extra.riskScore,
      replans: extra.replans || [],
    }
    orch.userLines = userStatus(orch)
    return orch
  }

  function selectVerifier(cfg, prefs, avoid) {
    if (!ASD.bg.modelRouter || typeof ASD.bg.modelRouter.selectModel !== 'function') return null
    const sel = ASD.bg.modelRouter.selectModel('fact_verification', { settings: cfg, hasImages: false }, prefs)
    if (!sel.ok || !sel.selected) return null
    let picked = sel.selected
    let independent = true
    if (avoid && picked.provider === avoid.provider && picked.model === avoid.model) {
      if (sel.fallbacks && sel.fallbacks[0] && sel.fallbacks[0].capabilities && sel.fallbacks[0].capabilities.structuredOutput !== false) {
        picked = sel.fallbacks[0]
        independent = true
      } else {
        independent = false
      }
    }
    if (picked.capabilities && picked.capabilities.structuredOutput === false) return null
    return { selected: picked, fallbacks: sel.fallbacks || [], independentVerification: independent }
  }

  async function callStage(stage, messages, executeFn, budget, traces, taskOverride, extras) {
    const extra = extras || {}
    const health = ASD.bg.modelHealth
    let alreadyFallback = false
    let alreadyRepaired = false
    let alreadyLengthRetry = false
    let used = { provider: stage.provider, model: stage.model, capabilities: stage.capabilities }
    let maxTokens = extra.maxTokens || 4200
    const fallbacks = stage.fallback ? [stage.fallback] : stage.fallbacks || []
    const task = taskOverride || stage.task

    while (true) {
      if (budget.requestMaxTokens) maxTokens = budget.requestMaxTokens(maxTokens)
      if (maxTokens < 1 || (budget.remainingOutputTokens && budget.remainingOutputTokens() < 1)) {
        if (budget.markTokenExceeded) budget.markTokenExceeded('TOKEN_OUTPUT_BUDGET_EXCEEDED')
        throwBudget('TOKEN_OUTPUT_BUDGET_EXCEEDED')
      }
      if (budget.canCall && !budget.canCall()) throwBudget((budget && budget.exhaustedReason) || 'ORCHESTRATION_BUDGET_EXCEEDED')
      if (budget.usedCalls >= budget.maxCalls) throwBudget()
      try {
        if (budget.consumeCall) budget.consumeCall()
        else budget.usedCalls += 1
      } catch (error) {
        throwBudget((error && error.code) || (budget && budget.exhaustedReason) || 'ORCHESTRATION_BUDGET_EXCEEDED')
      }
      const started = Date.now()
      try {
        const out = await executeFn({
          task: task,
          provider: used.provider,
          model: used.model,
          capabilities: used.capabilities,
          messages: messages,
          maxTokens: maxTokens,
          timeoutMs: budget.stageTimeout ? budget.stageTimeout(stage.id || task) : undefined,
        })
        const usage = normalizeUsage(out.usage, { messages: messages, content: out.result ? JSON.stringify(out.result) : '' })
        const cost = estimateCost(used, usage)
        if (budget.addUsage) budget.addUsage(usage, cost)
        if (budget.costExceeded) out.costBudgetExceeded = true
        if (budget.tokenExceeded) out.tokenBudgetExceeded = true
        if (health && !out._healthRecorded) {
          health.recordSuccess(used.provider, used.model, Date.now() - started)
        }
        traces.push({
          stage: stage.covers ? stage.covers.join('+') : stage.id,
          provider: used.provider,
          model: used.model,
          durationMs: Date.now() - started,
          success: true,
          fallbackUsed: alreadyFallback,
          schemaRepaired: alreadyRepaired,
        })
        out.usedFallback = alreadyFallback
        out.usageNormalized = usage
        out.cost = cost
        return out
      } catch (error) {
        if (health && !error._healthRecorded) {
          health.recordFailure(used.provider, used.model, Date.now() - started, error.code, {
            retryAfterMs: error.retryAfterMs,
          })
        }
        traces.push({
          stage: stage.id,
          provider: used.provider,
          model: used.model,
          durationMs: Date.now() - started,
          success: false,
          fallbackUsed: alreadyFallback,
          error: error.code || error.message,
        })
        const policy = ASD.bg.failoverPolicy
        let decision
        if (policy && typeof policy.decideFailureAction === 'function') {
          decision = policy.decideFailureAction({
            error: error,
            stage: stage,
            selected: used,
            fallbacks: fallbacks,
            budget: budget,
            health: health,
            alreadyFallback: alreadyFallback,
            alreadyRepaired: alreadyRepaired,
            alreadyLengthRetry: alreadyLengthRetry,
          })
        } else {
          const code = error && error.code
          const allow =
            !alreadyFallback &&
            (code === 'CONNECTION_ERROR' || code === 'NETWORK_ERROR' || code === 'RATE_LIMIT_ERROR' || code === 'TIMEOUT') &&
            fallbacks[0]
          decision = allow
            ? { action: 'fallback', reason: 'legacy_failover', target: fallbacks[0] }
            : { action: 'fail', reason: 'legacy_fail', target: null }
        }
        if (decision.action === 'retry_same') {
          if (decision.reason === 'schema_repair') alreadyRepaired = true
          if (decision.reason === 'raise_max_output_tokens') {
            alreadyLengthRetry = true
            const raised = Math.min(Math.max(maxTokens * 2, 6000), 8000)
            maxTokens = budget.requestMaxTokens ? budget.requestMaxTokens(raised) : raised
          }
          continue
        }
        if (decision.action === 'fallback' && decision.target) {
          alreadyFallback = true
          used = {
            provider: decision.target.provider || decision.target.providerId,
            model: decision.target.model,
            capabilities: decision.target.capabilities || used.capabilities,
          }
          continue
        }
        if (decision.action === 'degrade') {
          return { degraded: true, error: error, usedFallback: alreadyFallback }
        }
        throw error
      }
    }
  }

  async function runSingle(opts, cfg, built, plan, executeFn, visionPack, budget) {
    const started = Date.now()
    const traces = []
    const selected = plan.stages[0]
    const caps = selected.capabilities || {}
    const visionUrls = caps.vision === true ? (visionPack && visionPack.urls) || [] : []
    const intro = visionUrls.length
      ? '请结合真实图片像素与下列不可信页面数据完成诊断并输出 JSON。禁止根据图片文件名或 URL 猜测图片内容。'
      : '请根据下列不可信页面数据完成诊断并输出 JSON。当前模型未启用视觉能力，不得把图片 URL 当作图片证据。'
    const out = await callStage(
      selected,
      [
        { role: 'system', content: ASD.bg.promptBuilder.SYSTEM_PROMPT },
        { role: 'user', content: wrapUser(intro + '\n' + built.text, visionUrls) },
      ],
      executeFn,
      budget,
      traces,
      'product_diagnosis',
    )
    const snap = budget.snapshot ? budget.snapshot() : { usedCalls: budget.usedCalls }
    const replans = []
    if (traces.some(function (item) { return item && item.fallbackUsed })) {
      invokeReplan(budget, [], {
        trigger: 'FALLBACK_USED',
        beforeCalls: budget.remainingCalls ? budget.remainingCalls() + 1 : budget.maxCalls,
        keepVerifier: false,
        fallbackUsed: true,
        replans: replans,
      })
    }
    out.orchestration = summarize(plan, traces, Date.now() - started, snap.usedCalls || traces.length, {
      fallbackUsed: traces.some(function (item) { return item.fallbackUsed }),
      budget: snap,
      usage: { inputTokens: snap.inputTokens || 0, outputTokens: snap.outputTokens || 0 },
      cost: {
        estimatedCostUsd: snap.costKnown ? snap.estimatedCostUsd : null,
        costKnown: snap.costKnown !== false,
        costEstimated: !!snap.costEstimated,
        pricingVersion: snap.pricingVersion || '',
        sourceDate: snap.sourceDate || '',
      },
      completion: { status: 'complete', missingStages: [], reasons: [] },
      replans: replans,
    })
    out.visionUsed = visionUrls.length > 0
    out.payloadMode = built.mode
    out.payloadTruncated = built.truncated
    return out
  }

  function attachGuard(report, rejected, risk) {
    if (!ASD.bg.finalReportGuard || typeof ASD.bg.finalReportGuard.apply !== 'function') {
      return { result: report, downgraded: 0 }
    }
    return ASD.bg.finalReportGuard.apply(report, { rejectedClaims: rejected || [], risk: risk })
  }

  async function maybeVerify(opts, cfg, prefs, budget, traces, diagnosis, evidence, avoid, risk) {
    const empty = {
      triggered: false,
      provider: '',
      model: '',
      independentVerification: false,
      confirmed: 0,
      downgraded: 0,
      rejected: 0,
      riskScore: risk && risk.score,
      level: risk && risk.level,
      reasons: (risk && risk.reasons) || [],
    }
    if (!risk || !risk.requiresVerification) return { meta: empty, diagnosis: diagnosis, rejected: [] }
    if (opts && opts.skipVerifier) return { meta: empty, diagnosis: diagnosis, rejected: [] }
    if (!budget.canCall || !budget.canCall({ verifier: true })) return { meta: empty, diagnosis: diagnosis, rejected: [] }
    if (budget.usedCalls >= budget.maxCalls) return { meta: empty, diagnosis: diagnosis, rejected: [] }
    const picked = selectVerifier(cfg, prefs, avoid)
    if (!picked) return { meta: empty, diagnosis: diagnosis, rejected: [] }
    const schemas = ASD.orchestrationSchemas
    const prompt = ASD.bg.verificationPrompt && ASD.bg.verificationPrompt.systemPrompt
      ? ASD.bg.verificationPrompt.systemPrompt()
      : '只复核 claims，输出 decisions JSON。禁止 newFacts。'
    const payload = {
      claimsToVerify: risk.claimsToVerify || [],
      trustedPageEvidence: trustedPageEvidence(evidence),
      diagnosisDecisions: compactDiagnosis(diagnosis),
    }
    const stage = {
      id: 'verification',
      task: 'fact_verification',
      provider: picked.selected.provider,
      model: picked.selected.model,
      capabilities: picked.selected.capabilities,
      fallback: null,
      covers: ['verification'],
    }
    const out = await callStage(
      stage,
      [
        { role: 'system', content: prompt },
        { role: 'user', content: wrapUser(JSON.stringify(payload), []) },
      ],
      opts.executeFn || defaultExecute,
      budget,
      traces,
      'fact_verification',
    )
    const parsed = schemas && schemas.normalizeVerification ? schemas.normalizeVerification(out.result || out) : { ok: false }
    if (!parsed.ok) {
      return {
        meta: Object.assign({}, empty, {
          triggered: true,
          provider: picked.selected.provider,
          model: picked.selected.model,
          independentVerification: picked.independentVerification,
        }),
        diagnosis: diagnosis,
        rejected: [],
      }
    }
    const applied = schemas.applyVerifierDecisions(diagnosis, parsed.result)
    return {
      meta: {
        triggered: true,
        provider: picked.selected.provider,
        model: picked.selected.model,
        independentVerification: picked.independentVerification,
        confirmed: applied.counts.confirmed,
        downgraded: applied.counts.downgraded,
        rejected: applied.counts.rejected,
        riskScore: risk.score,
        level: risk.level,
        reasons: risk.reasons || [],
      },
      diagnosis: applied.diagnosis,
      rejected: applied.rejected,
    }
  }

  async function runMulti(opts, cfg, built, plan, executeFn, visionPack, budget, prefs) {
    const started = Date.now()
    const traces = []
    const replans = []
    let skipVerifier = false
    let alreadyReplannedFallback = false
    const schemas = ASD.orchestrationSchemas
    if (!schemas) {
      const error = new Error('ORCHESTRATION_SCHEMA_UNAVAILABLE')
      error.code = 'ORCHESTRATION_SCHEMA_UNAVAILABLE'
      throw error
    }

    if (plan.stages.length === 1) {
      const only = plan.stages[0]
      const coversAll = (only.covers || []).indexOf('evidence') !== -1 && (only.covers || []).indexOf('content') !== -1
      if (coversAll) return runSingle(opts, cfg, built, plan, executeFn, visionPack, budget)
    }

    let evidenceStage = plan.stages.find(function (item) { return (item.covers || [item.id]).indexOf('evidence') !== -1 })
    let diagnosisStage = plan.stages.find(function (item) { return (item.covers || [item.id]).indexOf('diagnosis') !== -1 })
    let contentStage = plan.stages.find(function (item) { return (item.covers || [item.id]).indexOf('content') !== -1 })

    let evidence = null
    const evidenceCaps = (evidenceStage && evidenceStage.capabilities) || {}
    const visionUrls = evidenceCaps.vision === true ? (visionPack && visionPack.urls) || [] : []
    const evidenceIntro = visionUrls.length
      ? '只观察和整理证据。结合图片像素与不可信页面数据。Vision 只能 OBSERVED。'
      : '只观察和整理文本证据。不得把图片 URL 当作视觉证据。'
    if (plan.textFallback) {
      traces.push({ stage: 'evidence', note: '未配置已确认支持视觉的模型，Stage 1 使用文本证据模式。' })
    }

    try {
      const evidenceOut = await callStage(
        evidenceStage,
        [
          { role: 'system', content: ASD.bg.evidencePrompt.systemPrompt() },
          { role: 'user', content: wrapUser(evidenceIntro + '\n' + built.text, visionUrls) },
        ],
        executeFn,
        budget,
        traces,
        'evidence_analysis',
      )
      if (evidenceOut && evidenceOut.degraded) {
        evidence = textOnlyEvidenceFromBundle(opts.productBundle || opts.product, opts.fields)
      } else {
        const evidenceParsed = schemas.normalizeEvidence(evidenceOut.result || evidenceOut, {
          sourceModel: evidenceStage.model,
          sourceProvider: evidenceStage.provider,
        })
        if (!evidenceParsed.ok) {
          const error = new Error('VALIDATION_ERROR:' + (evidenceParsed.errors || []).join(';'))
          error.code = 'VALIDATION_ERROR'
          throw error
        }
        evidence = evidenceParsed.result
      }
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR' || error.code === 'AUTH_ERROR' || error.code === 'UNSUPPORTED_CAPABILITY' || error.code === 'EVIDENCE_CONFLICT') {
        throw error
      }
      evidence = textOnlyEvidenceFromBundle(opts.productBundle || opts.product, opts.fields)
      traces.push({ stage: 'evidence', note: 'vision_or_stage_degraded_to_text', error: error.code || error.message })
    }

    const hadFailover = traces.some(function (item) {
      return item && (item.fallbackUsed || item.success === false)
    })
    const remainingAfterEvidence = budget.remainingCalls
      ? budget.remainingCalls({ keepVerifier: !!budget.reserveVerifier && !hadFailover })
      : Math.max(0, budget.maxCalls - budget.usedCalls)
    let diagnosis = null
    let sameDiagContent = diagnosisStage && contentStage && diagnosisStage.provider === contentStage.provider && diagnosisStage.model === contentStage.model
    let mustMergeRest =
      remainingAfterEvidence <= 1 ||
      (diagnosisStage && contentStage && diagnosisStage !== contentStage && remainingAfterEvidence < 2)

    function packExtras(completion, verification, riskScore) {
      const snap = budget.snapshot ? budget.snapshot() : { usedCalls: budget.usedCalls }
      return summarize(plan, traces, Date.now() - started, snap.usedCalls, {
        fallbackUsed: traces.some(function (item) { return item.fallbackUsed }),
        budget: snap,
        usage: { inputTokens: snap.inputTokens || 0, outputTokens: snap.outputTokens || 0 },
        cost: {
          estimatedCostUsd: snap.costKnown === false ? null : snap.estimatedCostUsd,
          costKnown: snap.costKnown !== false,
          costEstimated: !!snap.costEstimated,
          pricingVersion: snap.pricingVersion || '',
          sourceDate: snap.sourceDate || '',
        },
        verification: verification || null,
        completion: completion || { status: 'complete', missingStages: [], reasons: [] },
        riskScore: riskScore,
        replans: replans,
      })
    }

    function applyReplan(rp) {
      if (!rp) return
      if (rp.skipVerifier) skipVerifier = true
      if (rp.action === 'partial' || rp.action === 'stop') return rp
      if (!rp.stages || !rp.stages.length) return rp
      const nextDiag = rp.stages.find(function (item) { return (item.covers || [item.id]).indexOf('diagnosis') !== -1 })
      const nextContent = rp.stages.find(function (item) { return (item.covers || [item.id]).indexOf('content') !== -1 })
      if (nextDiag) diagnosisStage = nextDiag
      if (nextContent) contentStage = nextContent
      if (nextDiag && !nextContent) contentStage = nextDiag
      if (nextContent && !nextDiag) diagnosisStage = nextContent
      sameDiagContent = diagnosisStage && contentStage && diagnosisStage.provider === contentStage.provider && diagnosisStage.model === contentStage.model
      mustMergeRest = rp.action === 'merged_to_fit_budget' || diagnosisStage === contentStage
      return rp
    }

    function maybeReplanNow(remaining, triggerHint) {
      const fallbackUsed = traces.some(function (item) { return item && item.fallbackUsed })
      const keepVerifier = !!budget.reserveVerifier && !fallbackUsed
      const trigger =
        triggerHint ||
        replanTriggerOf(budget, remaining, {
          fallbackUsed: fallbackUsed,
          alreadyReplannedFallback: alreadyReplannedFallback,
          keepVerifier: keepVerifier,
        })
      if (!trigger) return null
      const beforeCalls = budget.remainingCalls ? budget.remainingCalls({ keepVerifier: keepVerifier }) : Math.max(0, budget.maxCalls - budget.usedCalls)
      const rp = invokeReplan(budget, remaining, {
        trigger: trigger,
        beforeCalls: beforeCalls,
        keepVerifier: keepVerifier,
        fallbackUsed: fallbackUsed,
        replans: replans,
      })
      if (trigger === 'FALLBACK_USED') alreadyReplannedFallback = true
      return applyReplan(rp)
    }

    async function finishFromDiagnosis(diag, contentRaw, completion) {
      const health = diagnosisStage && ASD.bg.modelHealth ? ASD.bg.modelHealth.get(diagnosisStage.provider, diagnosisStage.model) : {}
      const risk = ASD.bg.verificationRisk
        ? ASD.bg.verificationRisk.assessVerificationRisk({
            productBundle: opts.productBundle || opts.product,
            stage1: evidence,
            diagnosis: diag,
            orchestration: { schemaRepaired: traces.some(function (item) { return item.schemaRepaired }), stages: traces },
            health: health,
            content: contentRaw && contentRaw.content,
          })
        : { score: 0, level: 'low', reasons: [], requiresVerification: false, claimsToVerify: [] }
      const verified = await maybeVerify(
        { executeFn: executeFn, skipVerifier: skipVerifier },
        cfg,
        prefs,
        budget,
        traces,
        diag,
        evidence,
        { provider: (diagnosisStage && diagnosisStage.provider) || '', model: (diagnosisStage && diagnosisStage.model) || '' },
        risk,
      )
      const finalized = schemas.finalizeOrchestrationReport(
        verified.diagnosis,
        contentRaw,
        packExtras(completion, Object.assign({
          riskScore: risk.score,
          level: risk.level,
          reasons: risk.reasons,
        }, verified.meta), risk.score),
      )
      if (!finalized.ok) {
        const error = new Error('VALIDATION_ERROR:' + (finalized.errors || []).join(';'))
        error.code = 'VALIDATION_ERROR'
        throw error
      }
      const guarded = attachGuard(finalized.result, verified.rejected, risk)
      if (guarded.downgraded && finalized.result.debug && finalized.result.debug.orchestration && finalized.result.debug.orchestration.verification) {
        finalized.result.debug.orchestration.verification.downgraded =
          (finalized.result.debug.orchestration.verification.downgraded || 0) + guarded.downgraded
      }
      const orch = packExtras(
        completion,
        Object.assign({}, verified.meta, {
          riskScore: risk.score,
          level: risk.level,
          reasons: risk.reasons,
          downgraded: (verified.meta.downgraded || 0) + (guarded.downgraded || 0),
        }),
        risk.score,
      )
      if (guarded.result && guarded.result.debug) guarded.result.debug.orchestration = orch
      return {
        result: guarded.result,
        usage: null,
        model: (contentStage && contentStage.model) || (diagnosisStage && diagnosisStage.model) || '',
        provider: displayName((contentStage && contentStage.provider) || (diagnosisStage && diagnosisStage.provider)),
        attempts: budget.usedCalls,
        orchestration: orch,
        visionUsed: visionUrls.length > 0,
        payloadMode: built.mode,
        payloadTruncated: built.truncated,
      }
    }

    const afterEvidence = maybeReplanNow(laterStages(diagnosisStage, contentStage, evidenceStage))
    if (afterEvidence && (afterEvidence.action === 'partial' || afterEvidence.action === 'stop')) {
      const partialDiag = stubDiagnosisFromEvidence(evidence)
      return await finishFromDiagnosis(partialDiag, stubContentFromDiagnosis(partialDiag), {
        status: 'partial',
        missingStages: ['diagnosis', 'content'],
        reasons: [afterEvidence.reason && afterEvidence.reason[0] ? afterEvidence.reason[0] : afterEvidence.action],
      })
    }

    if (sameDiagContent || mustMergeRest || (diagnosisStage && contentStage && diagnosisStage === contentStage)) {
      if (!budget.canCall || !budget.canCall()) {
        const blocked = maybeReplanNow(laterStages(diagnosisStage, contentStage, evidenceStage), budget.exhaustedReason || 'BUDGET_EXCEEDED')
        const partialDiag = stubDiagnosisFromEvidence(evidence)
        return await finishFromDiagnosis(partialDiag, stubContentFromDiagnosis(partialDiag), {
          status: 'partial',
          missingStages: ['diagnosis', 'content'],
          reasons: [(blocked && blocked.reason && blocked.reason[0]) || budget.exhaustedReason || 'BUDGET_EXCEEDED'],
        })
      }
      const merged = diagnosisStage || contentStage
      const mergedOut = await callStage(
        merged,
        [
          { role: 'system', content: ASD.bg.contentPrompt.diagnosisAndContentPrompt() },
          {
            role: 'user',
            content: wrapUser(JSON.stringify({ product: built.object || built.text, evidence: compactEvidence(evidence) }), []),
          },
        ],
        executeFn,
        budget,
        traces,
        'product_diagnosis',
      )
      const finalReport = ASD.schema.normalizeAndValidate(mergedOut.result)
      if (!finalReport.ok) {
        const error = new Error('VALIDATION_ERROR:' + (finalReport.errors || []).join(';'))
        error.code = 'VALIDATION_ERROR'
        throw error
      }
      const guardedDiag = schemas.normalizeDiagnosis(
        {
          summary: finalReport.result.summary && finalReport.result.summary.identity,
          identity: { name: finalReport.result.summary.identity, confidence: finalReport.result.summary.confidence },
          facts: finalReport.result.facts,
          diagnosis: { strengths: [], issues: [], priorities: [] },
          keywordStrategy: { primary: [], secondary: [], blocked: [], rationale: [] },
          contentBrief: { titleGoals: [], detailGoals: [], faqGoals: [], geoGoals: [] },
        },
        evidence,
        { sourceModel: merged.model, sourceProvider: merged.provider },
      )
      if (guardedDiag.ok) {
        finalReport.result.facts = guardedDiag.result.facts
        diagnosis = guardedDiag.result
      }
      const finished = await finishFromDiagnosis(diagnosis || guardedDiag.result, finalReport.result, {
        status: 'complete',
        missingStages: [],
        reasons: [],
      })
      finished.visionUsed = visionUrls.length > 0
      return finished
    }

    if (!budget.canCall || !budget.canCall()) {
      const blocked = maybeReplanNow(laterStages(diagnosisStage, contentStage, evidenceStage), budget.exhaustedReason || 'BUDGET_EXCEEDED')
      const partialDiag = stubDiagnosisFromEvidence(evidence)
      return await finishFromDiagnosis(partialDiag, stubContentFromDiagnosis(partialDiag), {
        status: 'partial',
        missingStages: ['diagnosis', 'content'],
        reasons: [(blocked && blocked.reason && blocked.reason[0]) || budget.exhaustedReason || 'BUDGET_EXCEEDED'],
      })
    }

    let diagnosisOut
    try {
      diagnosisOut = await callStage(
        diagnosisStage,
        [
          { role: 'system', content: ASD.bg.diagnosisPrompt.systemPrompt() },
          {
            role: 'user',
            content: wrapUser(JSON.stringify({ product: built.object || built.text, evidence: compactEvidence(evidence) }), []),
          },
        ],
        executeFn,
        budget,
        traces,
        'diagnosis_reasoning',
      )
    } catch (error) {
      if (isBudgetCode(error)) {
        maybeReplanNow([contentStage].filter(Boolean), error.code)
        const partialDiag = stubDiagnosisFromEvidence(evidence)
        return await finishFromDiagnosis(partialDiag, stubContentFromDiagnosis(partialDiag), {
          status: 'partial',
          missingStages: ['diagnosis', 'content'],
          reasons: [error.code],
        })
      }
      throw error
    }
    const diagnosisParsed = schemas.normalizeDiagnosis(diagnosisOut.result || diagnosisOut, evidence, {
      sourceModel: diagnosisStage.model,
      sourceProvider: diagnosisStage.provider,
    })
    if (!diagnosisParsed.ok) {
      const error = new Error('VALIDATION_ERROR:' + (diagnosisParsed.errors || []).join(';'))
      error.code = 'VALIDATION_ERROR'
      throw error
    }
    diagnosis = diagnosisParsed.result

    const afterDiagnosis = maybeReplanNow([contentStage].filter(function (item) { return item && item !== diagnosisStage }))
    if (afterDiagnosis && (afterDiagnosis.action === 'partial' || afterDiagnosis.action === 'stop' || !budget.canCall || !budget.canCall())) {
      return await finishFromDiagnosis(diagnosis, stubContentFromDiagnosis(diagnosis), {
        status: 'partial',
        missingStages: ['content'],
        reasons: [(afterDiagnosis && afterDiagnosis.reason && afterDiagnosis.reason[0]) || budget.exhaustedReason || 'BUDGET_EXCEEDED'],
      })
    }

    let contentRaw = null
    try {
      const contentOut = await callStage(
        contentStage,
        [
          { role: 'system', content: ASD.bg.contentPrompt.systemPrompt() },
          {
            role: 'user',
            content: wrapUser(JSON.stringify({ product: built.object || built.text, diagnosis: compactDiagnosis(diagnosis) }), []),
          },
        ],
        executeFn,
        budget,
        traces,
        'raw_json',
      )
      if (contentOut && contentOut.degraded) throw contentOut.error || new Error('CONTENT_DEGRADED')
      contentRaw = contentOut.result || contentOut
      return await finishFromDiagnosis(diagnosis, contentRaw, { status: 'complete', missingStages: [], reasons: [] })
    } catch (error) {
      if (isBudgetCode(error) && !diagnosis) throw error
      if (isBudgetCode(error)) {
        maybeReplanNow([], error.code)
      }
      return await finishFromDiagnosis(diagnosis, stubContentFromDiagnosis(diagnosis), {
        status: 'partial',
        missingStages: ['content'],
        reasons: [error.code || error.message || 'content_failed'],
      })
    }
  }

  async function runProductDiagnosis(input) {
    requireSanitize()
    const opts = input || {}
    const executeFn = opts.executeFn || defaultExecute
    const cfg = opts.settings || (ASD.bg.settings ? await ASD.bg.settings.load() : {})
    const fields = opts.fields || {}
    const product = opts.productBundle || opts.product || null
    const visionSource = opts.images || (product && product.images) || fields.images || []
    const hasImages = visionSource.length > 0 || !!(opts.requestContext && opts.requestContext.hasImages)
    const built = ASD.bg.payloadBuilder.buildAnalyzePayload(product, fields)
    const bundle = cfg.providerConfigs || (ASD.providerConfigs ? ASD.providerConfigs.migrate(cfg) : {})
    const preference =
      (opts.preferences && opts.preferences.costPreference) || bundle.costPreference || 'balanced'
    const plan = ASD.bg.orchestrationPlanner.build({
      settings: cfg,
      hasImages: hasImages,
      orchestrationMode: opts.preferences && opts.preferences.orchestrationMode,
      costPreference: preference,
      requestContext: opts.requestContext,
    })
    if (!plan.ok) {
      const error = new Error((plan.reason || []).join('；') || '无法规划协同诊断')
      error.code = plan.code || 'NO_COMPATIBLE_MODEL'
      throw error
    }
    const budget = makeBudget(
      {
        mode: preference,
        costPreference: preference,
        maxCalls: opts.preferences && opts.preferences.maxCalls,
        maxDurationMs: opts.preferences && opts.preferences.maxDurationMs,
        maxEstimatedCostUsd: opts.preferences && opts.preferences.maxEstimatedCostUsd,
        maxInputTokens: opts.preferences && opts.preferences.maxInputTokens,
        maxOutputTokens: opts.preferences && opts.preferences.maxOutputTokens,
      },
      plan,
    )
    if (plan.estimatedCalls > budget.maxCalls) throwBudget()
    const selectedVision = plan.stages.some(function (stage) {
      return stage.capabilities && stage.capabilities.vision === true && (stage.covers || [stage.id]).indexOf('evidence') !== -1
    })
    const visionPack =
      selectedVision && ASD.bg.imageFetcher && typeof ASD.bg.imageFetcher.fetchVisionImages === 'function'
        ? await ASD.bg.imageFetcher.fetchVisionImages(visionSource)
        : { urls: [], picked: [], ranked: [] }
    const prefs = { mode: bundle.activeMode || 'auto', costPreference: preference }
    const out =
      plan.mode === 'single'
        ? await runSingle(opts, cfg, built, plan, executeFn, visionPack, budget)
        : await runMulti(opts, cfg, built, plan, executeFn, visionPack, budget, prefs)
    if (out.result && ASD.bg.finalReportGuard && plan.mode === 'single') {
      const guarded = attachGuard(out.result, [], null)
      out.result = guarded.result
    }
    out.plan = plan
    out.route = {
      ok: true,
      selected: plan.stages[0],
      reason: plan.reason,
      mode: plan.mode,
    }
    out.imageRank = (visionPack.ranked || []).map(function (img) {
      return {
        src: ASD.imageScore ? ASD.imageScore.redactSrc(img.src) : img.src,
        score: img.score || 0,
        reasons: img.reasons || [],
      }
    })
    return out
  }

  ns.bg.orchestrator = {
    runProductDiagnosis: runProductDiagnosis,
    compactEvidence: compactEvidence,
    compactDiagnosis: compactDiagnosis,
    userStatus: userStatus,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
