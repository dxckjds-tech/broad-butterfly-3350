;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const STAGE_IDS = ['evidence', 'diagnosis', 'content']
  const STAGE_TASKS = {
    evidence: 'evidence_analysis',
    diagnosis: 'diagnosis_reasoning',
    content: 'content_generation',
  }

  function maxCalls() {
    return (ASD.constants && ASD.constants.MAX_ORCHESTRATION_CALLS) || 3
  }

  function bundleOf(cfg) {
    if (cfg && cfg.providerConfigs) return cfg.providerConfigs
    return ASD.providerConfigs ? ASD.providerConfigs.migrate(cfg || {}) : { configs: {}, orchestrationMode: 'auto' }
  }

  function listUsable(cfg, requireAuto) {
    const bundle = bundleOf(cfg)
    const ids = ASD.providerRegistry ? ASD.providerRegistry.list().map(function (item) { return item.id }) : Object.keys(bundle.configs || {})
    return ids.filter(function (id) {
      const slot = ASD.providerConfigs ? ASD.providerConfigs.getConfig(bundle, id) : {}
      if (!slot || !String(slot.apiKey || '').trim()) return false
      if (slot.enabled === false) return false
      if (requireAuto && slot.participateInAuto === false) return false
      return true
    })
  }

  function select(task, context, prefs) {
    if (!ASD.bg.modelRouter || typeof ASD.bg.modelRouter.selectModel !== 'function') {
      return { ok: false, code: 'NO_COMPATIBLE_MODEL', selected: null, fallbacks: [], reason: ['路由器不可用'] }
    }
    return ASD.bg.modelRouter.selectModel(task, context, prefs)
  }

  function stageRow(id, selection, extras) {
    const selected = (selection && selection.selected) || {}
    return Object.assign(
      {
        id: id,
        task: STAGE_TASKS[id] || id,
        provider: selected.provider || '',
        model: selected.model || '',
        providerName: selected.providerName || selected.provider || '',
        capabilities: selected.capabilities || null,
        score: selected.score,
        reason: selected.reason || (selection && selection.reason) || [],
        fallback: selection && selection.fallbacks && selection.fallbacks[0] ? selection.fallbacks[0] : null,
        mergedWith: null,
        covers: [id],
      },
      extras || {},
    )
  }

  function singlePlan(selection, reason) {
    const row = stageRow('diagnosis', selection, {
      task: 'product_diagnosis',
      mergedWith: 'evidence+content',
      covers: STAGE_IDS.slice(),
    })
    return {
      ok: true,
      mode: 'single',
      stages: [row],
      estimatedCalls: 1,
      reason: reason || ['仅使用单模型诊断'],
      textFallback: !!(selection && selection.reason && selection.reason.indexOf('未配置已确认支持视觉的模型，改为纯文本诊断') !== -1),
    }
  }

  function fail(code, reason) {
    return { ok: false, code: code || 'NO_COMPATIBLE_MODEL', mode: 'multi', stages: [], estimatedCalls: 0, reason: Array.isArray(reason) ? reason : [String(reason || '')] }
  }

  function canCoverAll(selected, hasImages) {
    const caps = (selected && selected.capabilities) || {}
    if (!caps.structuredOutput || caps.text === false) return false
    if (hasImages && caps.vision !== true) return false
    return true
  }

  function build(input) {
    const ctx = input || {}
    const cfg = ctx.settings || ctx.cfg || {}
    const bundle = bundleOf(cfg)
    const orchMode = ctx.orchestrationMode || bundle.orchestrationMode || 'auto'
    const preference = ctx.costPreference || bundle.costPreference || 'balanced'
    const routeMode = ctx.routeMode || bundle.activeMode || 'auto'
    const hasImages = !!ctx.hasImages
    const usable = listUsable(cfg, routeMode !== 'fixed')
    const prefs = { mode: routeMode, costPreference: preference }
    const diagnosisCtx = { settings: cfg, hasImages: hasImages }

    if (orchMode === 'single') {
      const one = select('product_diagnosis', diagnosisCtx, prefs)
      if (!one.ok) return fail(one.code, one.reason)
      return attachCollaboration(singlePlan(one, ['orchestrationMode=single，保持 v1.6.1 单次诊断']), ctx, cfg, bundle)
    }

    if (orchMode === 'auto' && usable.length < 2) {
      const one = select('product_diagnosis', diagnosisCtx, prefs)
      if (!one.ok) return fail(one.code, one.reason)
      return attachCollaboration(singlePlan(one, ['仅 1 个可用 Provider，自动使用 single']), ctx, cfg, bundle)
    }

    if (orchMode === 'auto' && preference === 'economy') {
      const cheap = select('product_diagnosis', { settings: cfg, hasImages: false }, prefs)
      if (cheap.ok && canCoverAll(cheap.selected, hasImages)) {
        return attachCollaboration(singlePlan(cheap, ['省钱模式：单一低成本模型满足全部能力，使用 single']), ctx, cfg, bundle)
      }
    }

    const evidence = select('evidence_analysis', { settings: cfg, hasImages: hasImages }, prefs)
    const diagnosis = select('diagnosis_reasoning', { settings: cfg, hasImages: false }, prefs)
    const content = select('content_generation', { settings: cfg, hasImages: false }, prefs)
    if (!evidence.ok || !diagnosis.ok || !content.ok) {
      const fallback = select('product_diagnosis', diagnosisCtx, prefs)
      if (fallback.ok) return singlePlan(fallback, ['三阶段无法同时路由，回退 single'])
      return fail((evidence.code || diagnosis.code || content.code), evidence.reason || diagnosis.reason || content.reason)
    }

    const rawStages = [stageRow('evidence', evidence), stageRow('diagnosis', diagnosis), stageRow('content', content)]
    let stages = mergeAdjacent(rawStages)
    const stageCap = stageCallCap(preference)
    if (stages.length > stageCap) {
      stages = mergeToFit(stages, stageCap)
    }
    const costPlan = estimatePlanCostUsd(stages)
    const costCap = costCapUsd(preference)
    if (costPlan.costKnown && costCap != null && costPlan.estimatedCostUsd > costCap) {
      stages = mergeToFit(stages, Math.max(1, stages.length - 1))
    }
    if (stages.length > maxCalls()) {
      return fail('ORCHESTRATION_BUDGET_EXCEEDED', ['规划调用数超过 ' + maxCalls()])
    }
    const textFallback = !!(evidence.reason && evidence.reason.indexOf('未配置已确认支持视觉的模型，Stage 1 使用文本证据模式。') !== -1)
    const merged = stages.some(function (item) { return item.mergedWith })
    const reasons = []
    if (preference === 'economy') reasons.push('省钱模式：少调用、低成本、优先合并')
    else if (preference === 'quality') reasons.push('质量模式：能力优先，调用仍不超过预算')
    else reasons.push('平衡模式：质量、稳定、速度与成本')
    if (merged) reasons.push('相邻阶段选择同一模型，已合并调用')
    else reasons.push('三阶段独立路由')
    if (costPlan.costKnown && costCap != null && costPlan.estimatedCostUsd > costCap) reasons.push('cost_limit_replan')
    return attachCollaboration({
      ok: true,
      mode: 'multi',
      stages: stages,
      estimatedCalls: stages.length,
      reason: reasons,
      textFallback: textFallback,
      mergeEnabled: true,
      estimatedCostUsd: costPlan.estimatedCostUsd,
      costKnown: costPlan.costKnown,
    }, ctx, cfg, bundle)
  }

  function hasFixedRoles(bundle) {
    const rows = (bundle && bundle.roleAssignments) || {}
    return Object.keys(rows).some(function (key) {
      return rows[key] && rows[key].mode === 'fixed' && rows[key].provider
    })
  }

  function attachCollaboration(plan, ctx, cfg, bundle) {
    const collab = ASD.collaborationConfig ? ASD.collaborationConfig.normalize(bundle || {}) : { collaborationMode: 'auto' }
    const mode = ctx.collaborationMode || collab.collaborationMode || 'auto'
    if (ASD.bg.collaborationScheduler && (mode === 'custom' || mode === 'hybrid' || mode === 'single' || hasFixedRoles(collab))) {
      const next = ASD.bg.collaborationScheduler.build(Object.assign({}, ctx, { settings: cfg, collaborationMode: mode }))
      if (!next.ok) return next
      next.stages = (next.stages || []).map(function (stage) {
        const covers = stage.covers || []
        if (covers.indexOf('keywords') !== -1 && covers.indexOf('diagnosis') === -1) {
          stage.covers = covers.concat(['diagnosis'])
          if (stage.id === 'keywords') stage.id = 'diagnosis'
        }
        return stage
      })
      if (next.stages.length === 1) next.mode = 'single'
      return next
    }
    if (ASD.bg.collaborationScheduler && typeof ASD.bg.collaborationScheduler.assignRoles === 'function') {
      const assigned = ASD.bg.collaborationScheduler.assignRoles(Object.assign({}, ctx, { settings: cfg }))
      plan.assignments = assigned.assignments
      plan.collaborationMode = mode
      plan.failurePolicy = assigned.failurePolicy
    }
    return plan
  }

  function stageCallCap(preference) {
    const preset = ASD.bg.executionBudget && ASD.bg.executionBudget.preset(preference)
    if (!preset) return maxCalls()
    if (preset.reserveVerifier) return Math.min(maxCalls(), Math.max(1, preset.maxCalls - 1))
    return Math.min(maxCalls(), preset.maxCalls)
  }

  function costCapUsd(preference) {
    const preset = ASD.bg.executionBudget && ASD.bg.executionBudget.preset(preference)
    return preset ? preset.maxEstimatedCostUsd : null
  }

  function estimatePlanCostUsd(stages) {
    const pricing = (ASD.shared && ASD.shared.modelPricing) || ASD.modelPricing
    if (!pricing || typeof pricing.estimateCostUsd !== 'function') {
      return { costKnown: false, estimatedCostUsd: null }
    }
    let total = 0
    let known = true
    ;(stages || []).forEach(function (stage) {
      const row = pricing.estimateCostUsd({
        provider: stage.provider,
        model: stage.model,
        inputTokens: 4000,
        outputTokens: 1500,
      })
      if (!row.costKnown) known = false
      else total += Number(row.estimatedCostUsd) || 0
    })
    return { costKnown: known, estimatedCostUsd: known ? Math.round(total * 1e6) / 1e6 : null }
  }

  function mergeToFit(stages, max) {
    let out = (stages || []).map(cloneStage)
    while (out.length > max && out.length >= 2) {
      const right = out.pop()
      mergePair(out[out.length - 1], right)
    }
    return out
  }

  function replanAfterFailure(input) {
    const ctx = input || {}
    const remainingCalls = Math.max(0, Number(ctx.remainingCalls) || 0)
    const remainingDuration = ctx.remainingDuration == null ? 1 : Number(ctx.remainingDuration)
    const remainingCost = ctx.remainingCost
    const remainingStages = (ctx.remainingStages || []).map(cloneStage)
    const verificationRisk = ctx.verificationRisk || {}
    const reasons = []

    if (ctx.costExceeded || ctx.tokenExceeded) {
      return {
        action: 'partial',
        stages: [],
        skipVerifier: true,
        reason: [ctx.exhaustedReason || (ctx.costExceeded ? 'COST_BUDGET_EXCEEDED' : 'TOKEN_BUDGET_EXCEEDED')],
      }
    }
    if (ctx.remainingOutputTokens != null && Number(ctx.remainingOutputTokens) <= 0) {
      return { action: 'partial', stages: [], skipVerifier: true, reason: ['TOKEN_OUTPUT_BUDGET_EXCEEDED'] }
    }
    if (remainingDuration <= 0) {
      return { action: remainingStages.length ? 'partial' : 'stop', stages: [], skipVerifier: true, reason: ['duration_budget'] }
    }
    if (remainingCalls <= 0) {
      return { action: remainingStages.length ? 'partial' : 'stop', stages: [], skipVerifier: true, reason: ['call_budget'] }
    }

    let stages = remainingStages
    let action = stages.length ? 'continue' : 'partial'
    if (stages.length > remainingCalls) {
      stages = mergeToFit(stages, remainingCalls)
      reasons.push('merged_to_fit_budget')
      action = 'merged_to_fit_budget'
    }
    if (remainingCost != null && Number(remainingCost) <= 0 && stages.length > 1) {
      stages = mergeToFit(stages, 1)
      reasons.push('cost_budget')
      action = 'merged_to_fit_budget'
    }

    const wantVerifier = !!(verificationRisk.requiresVerification || verificationRisk.level === 'high')
    return {
      action: stages.length ? action : 'partial',
      stages: stages,
      skipVerifier: !wantVerifier || remainingCalls <= stages.length,
      reason: reasons,
    }
  }

  function cloneStage(stage) {
    return Object.assign({}, stage, { covers: (stage.covers || [stage.id]).slice(), reason: (stage.reason || []).slice() })
  }

  function sameTarget(a, b) {
    return !!(a && b && a.provider && a.model && a.provider === b.provider && a.model === b.model)
  }

  function canMergeEvidenceDiagnosis(stage) {
    const caps = (stage && stage.capabilities) || {}
    return caps.vision === true && caps.structuredOutput === true && caps.reasoning === true
  }

  function mergePair(left, right) {
    const covers = (left.covers || [left.id]).concat(right.covers || [right.id])
    left.covers = covers
    left.mergedWith = (right.covers || [right.id]).join('+')
    left.fallback = left.fallback || right.fallback
    if (covers.indexOf('evidence') !== -1 && covers.indexOf('diagnosis') !== -1 && covers.indexOf('content') !== -1) {
      left.id = 'evidence+diagnosis+content'
      left.task = 'product_diagnosis'
    } else if (covers.indexOf('diagnosis') !== -1 && covers.indexOf('content') !== -1) {
      left.id = 'diagnosis+content'
      left.task = 'diagnosis_and_content'
    } else if (covers.indexOf('evidence') !== -1 && covers.indexOf('diagnosis') !== -1) {
      left.id = 'evidence+diagnosis'
      left.task = 'evidence_and_diagnosis'
    }
    return left
  }

  function mergeAdjacent(stages) {
    if (!stages || !stages.length) return []
    const out = [cloneStage(stages[0])]
    for (let i = 1; i < stages.length; i += 1) {
      const prev = out[out.length - 1]
      const cur = stages[i]
      if (!sameTarget(prev, cur)) {
        out.push(cloneStage(cur))
        continue
      }
      const prevHasEvidence = (prev.covers || []).indexOf('evidence') !== -1
      const curHasDiagnosis = (cur.covers || [cur.id]).indexOf('diagnosis') !== -1
      if (prevHasEvidence && curHasDiagnosis && !canMergeEvidenceDiagnosis(cur)) {
        out.push(cloneStage(cur))
        continue
      }
      mergePair(prev, cur)
    }
    return out
  }

  ns.bg.orchestrationPlanner = {
    STAGE_IDS: STAGE_IDS,
    STAGE_TASKS: STAGE_TASKS,
    maxCalls: maxCalls,
    listUsable: listUsable,
    build: build,
    singlePlan: singlePlan,
    canCoverAll: canCoverAll,
    mergeAdjacent: mergeAdjacent,
    mergeToFit: mergeToFit,
    replanAfterFailure: replanAfterFailure,
    estimatePlanCostUsd: estimatePlanCostUsd,
    stageCallCap: stageCallCap,
    canMergeEvidenceDiagnosis: canMergeEvidenceDiagnosis,
    formatCollaboration: function formatCollaboration(plan) {
      if (ASD.bg.collaborationScheduler && typeof ASD.bg.collaborationScheduler.formatPlan === 'function' && (plan && (plan.assignments || plan.collaborationMode))) {
        const lines = ASD.bg.collaborationScheduler.formatPlan(plan)
        if (lines && lines.length) return lines
      }
      const label = { evidence: '证据', diagnosis: '诊断', content: '内容' }
      return ((plan && plan.stages) || []).map(function (stage) {
        const parts = (stage.covers || [stage.id]).map(function (id) {
          return label[id] || id
        })
        return parts.join(' + ') + '：' + (stage.providerName || displayName(stage.provider) || stage.provider)
      })
    },
  }

  function displayName(id) {
    const meta = ASD.providerRegistry && ASD.providerRegistry.get(id)
    return (meta && meta.name) || id || ''
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
