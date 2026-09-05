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

  function fallbackAllowed(error) {
    const code = error && error.code
    if (code === 'CONNECTION_ERROR' || code === 'RATE_LIMIT_ERROR' || code === 'TIMEOUT') return true
    return /超时|RATE_LIMIT|Failed to fetch/i.test((error && error.message) || '')
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

  async function defaultExecute(opts) {
    return ASD.bg.aiClient.callAI(opts)
  }

  async function runSingle(opts, cfg, built, plan, executeFn, visionPack) {
    const started = Date.now()
    const selected = plan.stages[0]
    const caps = selected.capabilities || {}
    const visionUrls = caps.vision === true ? (visionPack && visionPack.urls) || [] : []
    const intro = visionUrls.length
      ? '请结合真实图片像素与下列不可信页面数据完成诊断并输出 JSON。禁止根据图片文件名或 URL 猜测图片内容。'
      : '请根据下列不可信页面数据完成诊断并输出 JSON。当前模型未启用视觉能力，不得把图片 URL 当作图片证据。'
    const out = await executeFn({
      task: 'product_diagnosis',
      provider: selected.provider,
      model: selected.model,
      capabilities: caps,
      requestContext: { hasImages: !!(opts.requestContext && opts.requestContext.hasImages) },
      messages: [
        { role: 'system', content: ASD.bg.promptBuilder.SYSTEM_PROMPT },
        { role: 'user', content: wrapUser(intro + '\n' + built.text, visionUrls) },
      ],
    })
    out.orchestration = summarize(plan, [{ stage: 'diagnosis', provider: selected.provider, model: selected.model, durationMs: Date.now() - started, success: true, fallbackUsed: false }], Date.now() - started, 1)
    out.visionUsed = visionUrls.length > 0
    out.payloadMode = built.mode
    out.payloadTruncated = built.truncated
    return out
  }

  function summarize(plan, stages, durationMs, totalCalls) {
    return {
      mode: plan.mode,
      totalCalls: totalCalls,
      totalDurationMs: durationMs,
      estimatedCalls: plan.estimatedCalls,
      reason: plan.reason || [],
      textFallback: !!plan.textFallback,
      stages: stages,
    }
  }

  async function callStage(stage, messages, executeFn, budget, traces, taskOverride) {
    if (budget.used >= budget.max) {
      const error = new Error('ORCHESTRATION_BUDGET_EXCEEDED')
      error.code = 'ORCHESTRATION_BUDGET_EXCEEDED'
      throw error
    }
    const task = taskOverride || stage.task
    const started = Date.now()
    let fallbackUsed = false
    let used = { provider: stage.provider, model: stage.model, capabilities: stage.capabilities }
    try {
      budget.used += 1
      const out = await executeFn({
        task: task,
        provider: used.provider,
        model: used.model,
        capabilities: used.capabilities,
        messages: messages,
      })
      traces.push({ stage: stage.covers ? stage.covers.join('+') : stage.id, provider: used.provider, model: used.model, durationMs: Date.now() - started, success: true, fallbackUsed: false })
      return out
    } catch (error) {
      traces.push({ stage: stage.id, provider: used.provider, model: used.model, durationMs: Date.now() - started, success: false, fallbackUsed: false, error: error.code || error.message })
      const canFallback =
        fallbackAllowed(error) &&
        stage.fallback &&
        budget.used < budget.max &&
        (error.code === 'CONNECTION_ERROR' || error.code === 'RATE_LIMIT_ERROR' || error.code === 'TIMEOUT' || fallbackAllowed(error))
      if (!canFallback) throw error
      fallbackUsed = true
      used = { provider: stage.fallback.provider, model: stage.fallback.model, capabilities: stage.fallback.capabilities }
      budget.used += 1
      const retryAt = Date.now()
      const out = await executeFn({
        task: task,
        provider: used.provider,
        model: used.model,
        capabilities: used.capabilities,
        messages: messages,
      })
      traces.push({ stage: stage.id, provider: used.provider, model: used.model, durationMs: Date.now() - retryAt, success: true, fallbackUsed: true })
      out.usedFallback = fallbackUsed
      return out
    }
  }

  async function runMulti(opts, cfg, built, plan, executeFn, visionPack) {
    const started = Date.now()
    const budget = { max: maxCalls(), used: 0 }
    const traces = []
    const schemas = ASD.orchestrationSchemas
    if (!schemas) {
      const error = new Error('ORCHESTRATION_SCHEMA_UNAVAILABLE')
      error.code = 'ORCHESTRATION_SCHEMA_UNAVAILABLE'
      throw error
    }

    const evidenceStage = plan.stages.find(function (item) { return (item.covers || [item.id]).indexOf('evidence') !== -1 })
    const diagnosisStage = plan.stages.find(function (item) { return (item.covers || [item.id]).indexOf('diagnosis') !== -1 })
    const contentStage = plan.stages.find(function (item) { return (item.covers || [item.id]).indexOf('content') !== -1 })

    let evidence = null
    const evidenceCaps = (evidenceStage && evidenceStage.capabilities) || {}
    const visionUrls = evidenceCaps.vision === true ? (visionPack && visionPack.urls) || [] : []
    const evidenceIntro = visionUrls.length
      ? '只观察和整理证据。结合图片像素与不可信页面数据。Vision 只能 OBSERVED。'
      : '只观察和整理文本证据。不得把图片 URL 当作视觉证据。'
    if (plan.textFallback) {
      traces.push({ stage: 'evidence', note: '未配置已确认支持视觉的模型，Stage 1 使用文本证据模式。' })
    }
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

    const remainingAfterEvidence = budget.max - budget.used
    let diagnosis = null
    let contentRaw = null
    const sameDiagContent = diagnosisStage && contentStage && diagnosisStage.provider === contentStage.provider && diagnosisStage.model === contentStage.model
    const mustMergeRest = remainingAfterEvidence <= 1 || (diagnosisStage && contentStage && diagnosisStage !== contentStage && remainingAfterEvidence < 2)

    if (sameDiagContent || mustMergeRest || (diagnosisStage && contentStage && diagnosisStage === contentStage)) {
      const merged = diagnosisStage || contentStage
      const mergedOut = await callStage(
        merged,
        [
          { role: 'system', content: ASD.bg.contentPrompt.diagnosisAndContentPrompt() },
          {
            role: 'user',
            content: wrapUser(
              JSON.stringify({ product: built.object || built.text, evidence: compactEvidence(evidence) }),
              [],
            ),
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
      const guarded = schemas.normalizeDiagnosis(
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
      if (guarded.ok) finalReport.result.facts = guarded.result.facts
      mergedOut.result = finalReport.result
      mergedOut.orchestration = summarize(plan, traces, Date.now() - started, budget.used)
      mergedOut.visionUsed = visionUrls.length > 0
      mergedOut.payloadMode = built.mode
      mergedOut.payloadTruncated = built.truncated
      return mergedOut
    }

    const diagnosisOut = await callStage(
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
    contentRaw = contentOut.result || contentOut
    const finalized = schemas.finalizeOrchestrationReport(diagnosis, contentRaw, summarize(plan, traces, Date.now() - started, budget.used))
    if (!finalized.ok) {
      const error = new Error('VALIDATION_ERROR:' + (finalized.errors || []).join(';'))
      error.code = 'VALIDATION_ERROR'
      throw error
    }
    return {
      result: finalized.result,
      usage: contentOut.usage || diagnosisOut.usage || null,
      model: contentStage.model,
      provider: displayName(contentStage.provider),
      attempts: budget.used,
      orchestration: summarize(plan, traces, Date.now() - started, budget.used),
      visionUsed: visionUrls.length > 0,
      payloadMode: built.mode,
      payloadTruncated: built.truncated,
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
    const plan = ASD.bg.orchestrationPlanner.build({
      settings: cfg,
      hasImages: hasImages,
      orchestrationMode: opts.preferences && opts.preferences.orchestrationMode,
      costPreference: opts.preferences && opts.preferences.costPreference,
      requestContext: opts.requestContext,
    })
    if (!plan.ok) {
      const error = new Error((plan.reason || []).join('；') || '无法规划协同诊断')
      error.code = plan.code || 'NO_COMPATIBLE_MODEL'
      throw error
    }
    if (plan.estimatedCalls > maxCalls()) {
      const error = new Error('ORCHESTRATION_BUDGET_EXCEEDED')
      error.code = 'ORCHESTRATION_BUDGET_EXCEEDED'
      throw error
    }
    const selectedVision = plan.stages.some(function (stage) {
      return stage.capabilities && stage.capabilities.vision === true && (stage.covers || [stage.id]).indexOf('evidence') !== -1
    })
    const visionPack =
      selectedVision && ASD.bg.imageFetcher && typeof ASD.bg.imageFetcher.fetchVisionImages === 'function'
        ? await ASD.bg.imageFetcher.fetchVisionImages(visionSource)
        : { urls: [], picked: [], ranked: [] }
    const out = plan.mode === 'single'
      ? await runSingle(opts, cfg, built, plan, executeFn, visionPack)
      : await runMulti(opts, cfg, built, plan, executeFn, visionPack)
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
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
