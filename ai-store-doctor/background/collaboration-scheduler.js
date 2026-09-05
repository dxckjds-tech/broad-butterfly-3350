;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const ROLE_STAGE = {
    evidence: 'evidence',
    reasoning: 'diagnosis',
    keywords: 'keywords',
    content: 'content',
    verifier: 'verifier',
  }

  function collabOf(cfg) {
    const bundle = cfg && cfg.providerConfigs ? cfg.providerConfigs : cfg || {}
    return ASD.collaborationConfig ? ASD.collaborationConfig.normalize(bundle) : { collaborationMode: 'auto', roleAssignments: {}, failurePolicy: 'auto' }
  }

  function select(task, context, prefs) {
    if (!ASD.bg.modelRouter || typeof ASD.bg.modelRouter.selectModel !== 'function') {
      return { ok: false, code: 'NO_COMPATIBLE_MODEL', selected: null, reason: ['路由器不可用'] }
    }
    return ASD.bg.modelRouter.selectModel(task, context, prefs)
  }

  function resolveFixed(cfg, assignment) {
    if (!assignment || !assignment.provider) return { ok: false, code: 'ROLE_NOT_CONFIGURED', reason: ['未指定固定模型'] }
    const routed = ASD.bg.providerManager
      ? ASD.bg.providerManager.resolveProvider(cfg, assignment.provider)
      : { provider: assignment.provider, model: assignment.model, apiKey: '' }
    const model = assignment.model || routed.model
    const caps = ASD.modelCapabilities
      ? ASD.modelCapabilities.resolve(
          routed.id || assignment.provider,
          model,
          routed.config && routed.config.capabilitiesOverride,
          routed.config && routed.config.modelMetadata,
        )
      : { text: true, vision: false }
    return {
      ok: true,
      selected: {
        provider: routed.id || assignment.provider,
        model: model,
        providerName: routed.providerName || assignment.provider,
        capabilities: caps,
        apiKey: routed.apiKey,
        fixed: true,
      },
      fallbacks: [],
      reason: ['用户固定模型'],
    }
  }

  function capabilityMismatch(role, selected, hasImages) {
    if (role !== 'evidence' || !hasImages) return null
    const caps = (selected && selected.capabilities) || {}
    if (caps.vision === true) return null
    return {
      role: role,
      code: 'ROLE_CAPABILITY_MISMATCH',
      message: '当前固定模型不支持视觉输入。',
      options: ['continue_text', 'temporary_auto', 'cancel'],
    }
  }

  function assignRoles(input) {
    const ctx = input || {}
    const cfg = ctx.settings || ctx.cfg || {}
    const collab = collabOf(cfg)
    const mode = ctx.collaborationMode || collab.collaborationMode || 'auto'
    const hasImages = !!ctx.hasImages
    const prefs = { mode: ctx.routeMode || (cfg.providerConfigs && cfg.providerConfigs.activeMode) || 'auto', costPreference: ctx.costPreference || (cfg.providerConfigs && cfg.providerConfigs.costPreference) || 'balanced' }
    const assignments = {}
    const mismatches = []
    const warnings = []
    const roles = (ASD.collaborationConfig && ASD.collaborationConfig.ROLES) || ['evidence', 'reasoning', 'keywords', 'content', 'verifier']

    function autoFor(role) {
      const task = (ASD.collaborationConfig && ASD.collaborationConfig.ROLE_TASKS && ASD.collaborationConfig.ROLE_TASKS[role]) || 'product_diagnosis'
      const needImages = role === 'evidence' && hasImages
      return select(task, { settings: cfg, hasImages: needImages }, prefs)
    }

    if (mode === 'single') {
      const one =
        collab.singleModel && collab.singleModel.provider
          ? resolveFixed(cfg, { provider: collab.singleModel.provider, model: collab.singleModel.model })
          : select('product_diagnosis', { settings: cfg, hasImages: hasImages }, prefs)
      if (!one.ok) return { ok: false, code: one.code, reason: one.reason, assignments: {}, mismatches: [], mode: mode }
      roles.forEach(function (role) {
        assignments[role] = Object.assign({}, one.selected, { role: role, assignmentMode: 'single' })
        const mismatch = capabilityMismatch(role, one.selected, hasImages)
        if (mismatch) {
          if (collab.allowTemporaryAuto) {
            const auto = autoFor(role)
            if (auto.ok) assignments[role] = Object.assign({}, auto.selected, { role: role, assignmentMode: 'temporary_auto' })
            warnings.push('temporary_auto:' + role)
          } else if (collab.continueTextMode) {
            warnings.push('continue_text:' + role)
          } else {
            mismatches.push(mismatch)
          }
        }
      })
    } else {
      roles.forEach(function (role) {
        const row = (collab.roleAssignments && collab.roleAssignments[role]) || { mode: 'auto' }
        const wantFixed = mode === 'custom' || (mode === 'hybrid' && row.mode === 'fixed')
        if (wantFixed && row.provider) {
          const fixed = resolveFixed(cfg, row)
          if (!fixed.ok) {
            assignments[role] = { role: role, assignmentMode: 'fixed', error: fixed.code }
            return
          }
          assignments[role] = Object.assign({}, fixed.selected, { role: role, assignmentMode: 'fixed' })
          const mismatch = capabilityMismatch(role, fixed.selected, hasImages)
          if (mismatch) {
            if (collab.allowTemporaryAuto) {
              const auto = autoFor(role)
              if (auto.ok) assignments[role] = Object.assign({}, auto.selected, { role: role, assignmentMode: 'temporary_auto' })
              warnings.push('temporary_auto:' + role)
            } else if (collab.continueTextMode) {
              warnings.push('continue_text:' + role)
            } else {
              mismatches.push(mismatch)
            }
          }
          return
        }
        const auto = autoFor(role)
        if (auto.ok) assignments[role] = Object.assign({}, auto.selected, { role: role, assignmentMode: 'auto' })
      })
    }

    return {
      ok: mismatches.length === 0,
      code: mismatches.length ? 'ROLE_CAPABILITY_MISMATCH' : '',
      mode: mode,
      assignments: assignments,
      mismatches: mismatches,
      warnings: warnings,
      failurePolicy: collab.failurePolicy,
      reason: mismatches.map(function (item) { return item.message }),
    }
  }

  function sameTarget(a, b) {
    return !!(a && b && a.provider && a.model && a.provider === b.provider && a.model === b.model)
  }

  function stageFromRole(role, assignment) {
    return {
      id: ROLE_STAGE[role] || role,
      role: role,
      task: (ASD.collaborationConfig && ASD.collaborationConfig.ROLE_TASKS && ASD.collaborationConfig.ROLE_TASKS[role]) || role,
      provider: assignment.provider || '',
      model: assignment.model || '',
      providerName: assignment.providerName || assignment.provider || '',
      capabilities: assignment.capabilities || null,
      assignmentMode: assignment.assignmentMode || 'auto',
      fixed: assignment.assignmentMode === 'fixed',
      fallback: assignment.assignmentMode === 'fixed' ? null : assignment.fallback || null,
      mergedWith: null,
      covers: [ROLE_STAGE[role] || role],
      roles: [role],
    }
  }

  function mergeRoles(left, right) {
    left.roles = (left.roles || []).concat(right.roles || [right.role])
    left.covers = (left.covers || []).concat(right.covers || [right.id])
    left.mergedWith = (right.roles || [right.role]).join('+')
    if (left.roles.indexOf('reasoning') !== -1 && left.roles.indexOf('keywords') !== -1) {
      left.id = 'diagnosis'
      left.task = 'diagnosis_reasoning'
    }
    if (left.roles.indexOf('reasoning') !== -1 && left.roles.indexOf('content') !== -1) {
      left.id = 'diagnosis+content'
      left.task = 'diagnosis_and_content'
    }
    return left
  }

  function planFromAssignments(resolved, preference) {
    const order = ['evidence', 'reasoning', 'keywords', 'content']
    const raw = []
    order.forEach(function (role) {
      const assignment = resolved.assignments[role]
      if (assignment && assignment.provider) raw.push(stageFromRole(role, assignment))
    })
    const mergedRoles = []
    const stages = []
    raw.forEach(function (stage) {
      const prev = stages[stages.length - 1]
      const canMerge =
        prev &&
        sameTarget(prev, stage) &&
        !((prev.roles || []).indexOf('evidence') !== -1 && (stage.roles || []).indexOf('content') !== -1) &&
        ((prev.roles || []).indexOf('reasoning') !== -1 && (stage.roles || []).indexOf('keywords') !== -1
          ? true
          : (prev.roles || []).indexOf('keywords') !== -1 && (stage.roles || []).indexOf('content') !== -1
            ? preference !== 'quality'
            : (prev.roles || []).indexOf('reasoning') !== -1 && (stage.roles || []).indexOf('content') !== -1)
      if (canMerge) {
        mergeRoles(prev, stage)
        mergedRoles.push((prev.roles || []).join('+'))
      } else {
        stages.push(stage)
      }
    })
    const cap = preference === 'economy' ? 3 : 4
    while (stages.length > cap && stages.length >= 2) {
      const right = stages.pop()
      if (right.fixed || stages[stages.length - 1].fixed) {
        stages.push(right)
        break
      }
      mergeRoles(stages[stages.length - 1], right)
      mergedRoles.push((stages[stages.length - 1].roles || []).join('+'))
    }
    return { stages: stages, mergedRoles: mergedRoles }
  }

  function build(input) {
    const ctx = input || {}
    const resolved = assignRoles(ctx)
    if (!resolved.ok) {
      return {
        ok: false,
        code: resolved.code || 'ROLE_CAPABILITY_MISMATCH',
        mode: resolved.mode,
        stages: [],
        estimatedCalls: 0,
        reason: resolved.reason,
        mismatches: resolved.mismatches,
        assignments: resolved.assignments,
        collaboration: resolved,
      }
    }
    const preference = ctx.costPreference || 'balanced'
    const packed = planFromAssignments(resolved, preference)
    return {
      ok: true,
      mode: resolved.mode === 'single' ? 'single' : packed.stages.length <= 1 ? 'single' : 'multi',
      collaborationMode: resolved.mode,
      stages: packed.stages,
      estimatedCalls: packed.stages.length,
      reason: ['collaboration:' + resolved.mode],
      assignments: resolved.assignments,
      mergedRoles: packed.mergedRoles,
      failurePolicy: resolved.failurePolicy,
      warnings: resolved.warnings,
      textFallback: (resolved.warnings || []).some(function (item) { return String(item).indexOf('continue_text') === 0 }),
      collaboration: resolved,
    }
  }

  function formatPlan(plan) {
    const labels = (ASD.collaborationConfig && ASD.collaborationConfig.ROLE_LABELS) || {}
    const lines = []
    ;((plan && plan.stages) || []).forEach(function (stage) {
      const roles = stage.roles || [stage.role || stage.id]
      const title = roles
        .map(function (role) {
          return labels[role] || role
        })
        .join(' + ')
      lines.push(title + ' → ' + (stage.providerName || stage.provider) + (stage.model ? ' / ' + stage.model : ''))
    })
    if (plan && plan.assignments && plan.assignments.verifier) {
      const v = plan.assignments.verifier
      lines.push('事实复核 → ' + (v.assignmentMode === 'auto' ? '自动（仅高风险）' : (v.providerName || v.provider || '')))
    }
    return lines
  }

  function formatExecution(traces, plan) {
    const counts = {}
    ;(traces || []).forEach(function (item) {
      if (!item || !item.model) return
      const key = (item.providerName || item.provider || '') + ' / ' + item.model
      counts[key] = (counts[key] || 0) + 1
    })
    const lines = Object.keys(counts).map(function (key) {
      return key + ' ' + counts[key] + '次'
    })
    const verified = (traces || []).some(function (item) { return item && item.stage === 'verification' && item.success })
    if (!verified) lines.push('Verifier未触发')
    return {
      lines: lines,
      counts: counts,
      mergedRoles: (plan && plan.mergedRoles) || [],
    }
  }

  ns.bg.collaborationScheduler = {
    assignRoles: assignRoles,
    build: build,
    formatPlan: formatPlan,
    formatExecution: formatExecution,
    capabilityMismatch: capabilityMismatch,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
