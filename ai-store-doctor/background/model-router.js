;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const MODE_WEIGHTS = {
    economy: { quality: 0.15, reliability: 0.15, speed: 0.3, cost: 0.3, taskMatch: 0.1 },
    balanced: { quality: 0.3, reliability: 0.2, speed: 0.2, cost: 0.15, taskMatch: 0.15 },
    quality: { quality: 0.45, reliability: 0.15, speed: 0.1, cost: 0.05, taskMatch: 0.25 },
  }

  function resolve(cfg) {
    if (ASD.bg.providerManager && typeof ASD.bg.providerManager.resolveProvider === 'function') {
      return ASD.bg.providerManager.resolveProvider(cfg, cfg && cfg.provider)
    }
    const isKimi = cfg.provider === 'kimi' || cfg.provider === 'moonshot'
    const apiKey = isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey
    const providerName = isKimi ? 'Kimi' : 'DeepSeek'
    const baseUrl = isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl
    const model = isKimi ? cfg.kimiModel : cfg.deepseekModel
    const isK3 = isKimi && /kimi-k3/i.test(model)
    return { isKimi, apiKey, providerName, baseUrl, model, isK3 }
  }

  function isVisionCapable(model, providerId) {
    if (ASD.modelCapabilities && typeof ASD.modelCapabilities.resolve === 'function') {
      return !!ASD.modelCapabilities.resolve(providerId, model).vision
    }
    return false
  }

  function bundleOf(cfg) {
    if (cfg && cfg.providerConfigs) return cfg.providerConfigs
    return ASD.providerConfigs ? ASD.providerConfigs.migrate(cfg || {}) : { configs: {}, activeMode: 'auto', costPreference: 'balanced' }
  }

  function candidate(cfg, providerId, modelOverride) {
    const routed = ASD.bg.providerManager
      ? ASD.bg.providerManager.resolveProvider(cfg, providerId)
      : resolve(cfg)
    const id = routed.id || providerId
    const slot = routed.config || {}
    const model = modelOverride || routed.model
    const override = slot.capabilitiesOverride
    const caps =
      routed.capabilities && (!modelOverride || modelOverride === routed.model)
        ? routed.capabilities
        : ASD.modelCapabilities
          ? ASD.modelCapabilities.resolve(id, model, override, slot.modelMetadata || null)
          : { text: true, vision: false, reasoning: false, structuredOutput: false, longContext: false }
    const scores = ASD.modelCapabilities ? ASD.modelCapabilities.scoresFor(id, model) : { quality: { writing: 70 }, reliability: 70, speed: 70, cost: 70 }
    const health = ASD.bg.modelHealth ? ASD.bg.modelHealth.get(id, model) : { consecutiveFailures: 0, successCount: 0, failureCount: 0, avgLatencyMs: 0 }
    return {
      provider: id,
      model: model,
      capabilities: caps,
      scores: scores,
      health: health,
      apiKey: routed.apiKey,
      enabled: slot.enabled !== false && !!routed.apiKey,
      participateInAuto: slot.participateInAuto !== false,
      providerName: routed.providerName || id,
      routed: routed,
    }
  }

  function rejectReason(item, required, mode) {
    if (!item.apiKey) return 'NO_API_KEY'
    if (item.enabled === false) return 'DISABLED'
    if (mode === 'auto' && item.participateInAuto === false) return 'NOT_IN_AUTO'
    if (ASD.bg.modelHealth && ASD.bg.modelHealth.isCircuitOpen(item.health)) return 'CIRCUIT_OPEN'
    if (ASD.modelCapabilities && !ASD.modelCapabilities.hasRequired(item.capabilities, required)) return 'MISSING_CAPABILITY'
    return null
  }

  function qualityScore(item, profile, task) {
    const q = item.scores.quality || {}
    if (task === 'translation') return q.translation != null ? q.translation : 70
    let value = q.writing != null ? q.writing : 70
    if (profile.preferred && profile.preferred.reasoning && item.capabilities.reasoning) {
      value = Math.round((value + (q.reasoning || value)) / 2)
    }
    if (profile.preferred && profile.preferred.vision && item.capabilities.vision) {
      value = Math.round((value + (q.vision || value)) / 2)
    }
    if (profile.required && profile.required.structuredOutput) {
      value = Math.round((value + (q.jsonReliability || value)) / 2)
    }
    return value
  }

  function reliabilityScore(item) {
    const base = item.scores.reliability || 70
    const total = (item.health.successCount || 0) + (item.health.failureCount || 0)
    if (!total) return base
    const rate = item.health.successCount / total
    return Math.round(base * 0.4 + rate * 100 * 0.6)
  }

  function speedScore(item) {
    const base = item.scores.speed || 70
    if (!item.health.avgLatencyMs) return base
    if (item.health.avgLatencyMs < 1500) return Math.min(100, base + 8)
    if (item.health.avgLatencyMs > 8000) return Math.max(20, base - 15)
    return base
  }

  function taskMatchScore(item, profile, required) {
    let score = 55
    if (ASD.modelCapabilities && ASD.modelCapabilities.hasRequired(item.capabilities, required)) score += 20
    const preferred = (profile && profile.preferred) || {}
    Object.keys(preferred).forEach(function (key) {
      if (preferred[key] && item.capabilities[key]) score += 8
    })
    return Math.min(100, score)
  }

  function finalScore(item, task, profile, required, preference) {
    const weights = MODE_WEIGHTS[preference] || MODE_WEIGHTS.balanced
    const parts = {
      quality: qualityScore(item, profile, task),
      reliability: reliabilityScore(item),
      speed: speedScore(item),
      cost: item.scores.cost != null ? item.scores.cost : 70,
      taskMatch: taskMatchScore(item, profile, required),
    }
    const penalty = ASD.bg.modelHealth ? ASD.bg.modelHealth.temporaryPenalty(item.health) : 0
    const total =
      parts.quality * weights.quality +
      parts.reliability * weights.reliability +
      parts.speed * weights.speed +
      parts.cost * weights.cost +
      parts.taskMatch * weights.taskMatch -
      penalty
    return { total: Math.round(total * 10) / 10, parts: parts, penalty: penalty }
  }

  function explain(item, task, context, preference, profile) {
    const reason = []
    if (context && context.hasImages && item.capabilities.vision) reason.push('任务包含商品图片')
    if (profile && profile.required && profile.required.structuredOutput && item.capabilities.structuredOutput) {
      reason.push('需要结构化 JSON')
    }
    if (task === 'translation') reason.push('翻译任务更重视速度与成本')
    if (preference === 'economy') reason.push('当前处于省钱模式')
    else if (preference === 'quality') reason.push('当前处于最佳质量模式')
    else reason.push('当前处于平衡模式')
    if (item.capabilities.vision) reason.push('支持图片')
    if ((item.scores.quality || {}).jsonReliability >= 84) reason.push('JSON 稳定性较高')
    reason.push('提供商 ' + item.providerName)
    return reason
  }

  function advancedMapping(bundle, task) {
    const adv = (bundle && bundle.advanced) || {}
    if (task === 'translation') return adv.translation
    if (task === 'vision_analysis') return adv.vision_analysis
    if (task === 'title_generation' || task === 'detail_generation' || task === 'faq_generation' || task === 'geo_generation') {
      return adv.content
    }
    return adv.product_diagnosis
  }

  function fail(reason, extras) {
    return Object.assign(
      {
        ok: false,
        code: 'NO_COMPATIBLE_MODEL',
        selected: null,
        fallbacks: [],
        reason: Array.isArray(reason) ? reason : [String(reason || '没有兼容模型')],
        suggestAuto: false,
      },
      extras || {},
    )
  }

  function collectAuto(cfg, bundle) {
    const ids = ASD.providerRegistry ? ASD.providerRegistry.list().map(function (item) { return item.id }) : Object.keys(bundle.configs || {})
    return ids.map(function (id) {
      return candidate(cfg, id)
    })
  }

  function selectModel(task, context, preferences) {
    const ctx = context || {}
    const cfg = ctx.settings || ctx.cfg || {}
    const bundle = bundleOf(cfg)
    const prefs = preferences || {}
    const mode = prefs.mode || bundle.activeMode || 'auto'
    const preference = prefs.costPreference || bundle.costPreference || 'balanced'
    const profile = ASD.taskProfiles ? ASD.taskProfiles.get(task) : { required: { text: true }, preferred: {} }
    const required = ASD.taskProfiles ? ASD.taskProfiles.requiredFor(task, ctx) : profile.required || {}
    const canTextFallback =
      !!ctx.hasImages && (task === 'product_diagnosis' || task === 'product_identity' || task === 'fact_extraction')
    let pool = []

    if (mode === 'fixed') {
      const fixed = bundle.fixed || {}
      const item = candidate(cfg, fixed.provider || cfg.provider, fixed.model || '')
      const blocked = rejectReason(item, required, 'fixed')
      if (blocked) {
        const result = fail(
          blocked === 'MISSING_CAPABILITY' ? ['当前固定模型不支持该任务所需能力'] : ['固定模型不可用：' + blocked],
          { suggestAuto: true, filter: blocked },
        )
        ns.bg.modelRouter.lastResult = result
        return result
      }
      pool = [item]
    } else if (mode === 'advanced') {
      const mapped = advancedMapping(bundle, task) || {}
      if (mapped.provider && mapped.model) {
        pool = [candidate(cfg, mapped.provider, mapped.model)]
      } else {
        pool = collectAuto(cfg, bundle)
      }
    } else {
      pool = collectAuto(cfg, bundle)
    }

    function rankWith(req, extraReasons) {
      const rows = []
      pool.forEach(function (item) {
        const blocked = rejectReason(item, req, mode === 'advanced' ? 'auto' : mode)
        if (blocked) return
        const scored = finalScore(item, task, profile, req, preference)
        rows.push({
          provider: item.provider,
          model: item.model,
          capabilities: item.capabilities,
          score: scored.total,
          parts: scored.parts,
          penalty: scored.penalty,
          providerName: item.providerName,
          reason: explain(item, task, extraReasons && extraReasons.textFallback ? { hasImages: false } : ctx, preference, profile).concat(
            extraReasons && extraReasons.textFallback ? ['未配置已确认支持视觉的模型，改为纯文本诊断'] : [],
          ),
        })
      })
      rows.sort(function (a, b) {
        return b.score - a.score
      })
      return rows
    }

    let ranked = rankWith(required, null)
    if (!ranked.length && canTextFallback && mode !== 'fixed') {
      const textRequired = Object.assign({}, required)
      delete textRequired.vision
      ranked = rankWith(textRequired, { textFallback: true })
    }
    if (
      !ranked.length &&
      mode !== 'fixed' &&
      (task === 'product_diagnosis' || task === 'product_identity' || task === 'fact_extraction')
    ) {
      const loose = Object.assign({}, required)
      delete loose.vision
      delete loose.structuredOutput
      ranked = rankWith(loose, canTextFallback ? { textFallback: true } : null)
    }
    if (!ranked.length) {
      const result = fail(['没有已配置且支持该任务能力的模型'], { suggestAuto: mode === 'fixed' })
      ns.bg.modelRouter.lastResult = result
      return result
    }
    const result = {
      ok: true,
      code: 'OK',
      selected: ranked[0],
      fallbacks: ranked.slice(1, 2),
      reason: ranked[0].reason,
      mode: mode,
      costPreference: preference,
      task: task,
    }
    ns.bg.modelRouter.lastResult = result
    return result
  }

  ns.bg.modelRouter = {
    resolve: resolve,
    isVisionCapable: isVisionCapable,
    selectModel: selectModel,
    MODE_WEIGHTS: MODE_WEIGHTS,
    lastResult: null,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
