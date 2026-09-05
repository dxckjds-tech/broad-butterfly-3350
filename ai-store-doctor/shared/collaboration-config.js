;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const ROLES = ['evidence', 'reasoning', 'keywords', 'content', 'verifier']

  const ROLE_LABELS = {
    evidence: '证据/视觉',
    reasoning: '推理诊断',
    keywords: '关键词',
    content: '内容生成',
    verifier: '事实复核',
  }

  const ROLE_TASKS = {
    evidence: 'evidence_analysis',
    reasoning: 'diagnosis_reasoning',
    keywords: 'diagnosis_reasoning',
    content: 'content_generation',
    verifier: 'fact_verification',
  }

  const MODES = {
    AUTO: 'auto',
    CUSTOM: 'custom',
    SINGLE: 'single',
    HYBRID: 'hybrid',
  }

  const FAILURE_POLICIES = {
    AUTO: 'auto',
    ASK: 'ask',
    STOP: 'stop',
  }

  function emptyAssignment() {
    return { mode: 'auto', provider: '', model: '' }
  }

  function defaultAssignments() {
    const out = {}
    ROLES.forEach(function (role) {
      out[role] = emptyAssignment()
    })
    return out
  }

  function normalizeAssignment(raw) {
    const src = raw && typeof raw === 'object' ? raw : {}
    const mode = src.mode === 'fixed' ? 'fixed' : 'auto'
    return {
      mode: mode,
      provider: mode === 'fixed' ? String(src.provider || '') : '',
      model: mode === 'fixed' ? String(src.model || '') : '',
    }
  }

  function normalize(bundle) {
    const src = bundle && typeof bundle === 'object' ? bundle : {}
    const mode = MODES[String(src.collaborationMode || '').toUpperCase()] || src.collaborationMode
    const collaborationMode = mode === 'custom' || mode === 'single' || mode === 'hybrid' ? mode : 'auto'
    const assignments = defaultAssignments()
    const incoming = src.roleAssignments && typeof src.roleAssignments === 'object' ? src.roleAssignments : {}
    ROLES.forEach(function (role) {
      assignments[role] = normalizeAssignment(incoming[role])
      if (collaborationMode === 'single') assignments[role] = Object.assign({}, assignments[role], { mode: 'auto' })
      if (collaborationMode === 'custom' && !assignments[role].provider) assignments[role].mode = 'auto'
    })
    let failurePolicy = src.failurePolicy
    if (failurePolicy !== 'auto' && failurePolicy !== 'ask' && failurePolicy !== 'stop') {
      failurePolicy = collaborationMode === 'custom' ? 'ask' : 'auto'
    }
    return {
      collaborationMode: collaborationMode,
      roleAssignments: assignments,
      singleModel: {
        provider: (src.singleModel && src.singleModel.provider) || '',
        model: (src.singleModel && src.singleModel.model) || '',
      },
      failurePolicy: failurePolicy,
      allowTemporaryAuto: src.allowTemporaryAuto === true,
      continueTextMode: src.continueTextMode === true,
    }
  }

  function defaultFailurePolicy(mode) {
    return mode === 'custom' ? 'ask' : 'auto'
  }

  ns.collaborationConfig = {
    ROLES: ROLES,
    ROLE_LABELS: ROLE_LABELS,
    ROLE_TASKS: ROLE_TASKS,
    MODES: MODES,
    FAILURE_POLICIES: FAILURE_POLICIES,
    emptyAssignment: emptyAssignment,
    defaultAssignments: defaultAssignments,
    normalize: normalize,
    defaultFailurePolicy: defaultFailurePolicy,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
