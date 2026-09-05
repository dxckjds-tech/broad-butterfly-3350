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
      return singlePlan(one, ['orchestrationMode=single，保持 v1.6.1 单次诊断'])
    }

    if (orchMode === 'auto' && usable.length < 2) {
      const one = select('product_diagnosis', diagnosisCtx, prefs)
      if (!one.ok) return fail(one.code, one.reason)
      return singlePlan(one, ['仅 1 个可用 Provider，自动使用 single'])
    }

    if (orchMode === 'auto' && preference === 'economy') {
      const cheap = select('product_diagnosis', diagnosisCtx, prefs)
      if (cheap.ok && canCoverAll(cheap.selected, hasImages)) {
        return singlePlan(cheap, ['省钱模式：单一低成本模型满足全部能力，使用 single'])
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

    const stages = [stageRow('evidence', evidence), stageRow('diagnosis', diagnosis), stageRow('content', content)]
    const textFallback = !!(evidence.reason && evidence.reason.indexOf('未配置已确认支持视觉的模型，Stage 1 使用文本证据模式。') !== -1)
    return {
      ok: true,
      mode: 'multi',
      stages: stages,
      estimatedCalls: stages.length,
      reason: ['三阶段独立路由'],
      textFallback: textFallback,
      mergeEnabled: false,
    }
  }

  ns.bg.orchestrationPlanner = {
    STAGE_IDS: STAGE_IDS,
    STAGE_TASKS: STAGE_TASKS,
    maxCalls: maxCalls,
    listUsable: listUsable,
    build: build,
    singlePlan: singlePlan,
    canCoverAll: canCoverAll,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
