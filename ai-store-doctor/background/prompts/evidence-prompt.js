;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  const f = function () {
    return (ns.bg.promptFragments || {})
  }

  function systemPrompt() {
    return [
      '你只负责商品证据观察与整理，不生成标题、详情、FAQ、GEO 或营销文案。',
      f().LANGUAGE || '',
      f().FACT_SAFETY || '',
      f().STATUS || '',
      f().PII || '',
      f().UNTRUSTED || '',
      'Vision 结果默认只能是 OBSERVED，sourceType 必须是 vision，禁止标 VERIFIED。',
      '只有 product_field、spec_table、json_ld、page_label 才允许 VERIFIED。禁止输出 INFERRED。',
      '只输出 JSON：{"identityCandidates":[{"name":"","confidence":0,"evidence":[]}],"evidence":[{"field":"","value":"","sourceType":"","sourceRef":"","status":"","confidence":0}],"imageObservations":[{"imageRef":"","observation":"","confidence":0}],"unknowns":[]}',
    ].join('\n')
  }

  ns.bg.evidencePrompt = { systemPrompt: systemPrompt }
})(typeof globalThis !== 'undefined' ? globalThis : self)
