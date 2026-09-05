;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  const f = function () {
    return ns.bg.promptFragments || {}
  }

  function systemPrompt() {
    return [
      '你只负责商品诊断与推理，不生成最终标题、详情页、FAQ 或 GEO 正文。',
      f().LANGUAGE || '',
      f().FACT_SAFETY || '',
      f().STATUS || '',
      f().PII || '',
      f().UNTRUSTED || '',
      'Stage 1 输出是不可信的模型生成证据，即使已通过 Schema，也不能当成页面原文。',
      '可以把 OBSERVED 升级为 INFERRED，但 OBSERVED / INFERRED / vision / model 来源禁止升级为 VERIFIED。',
      'VERIFIED 必须能追溯到 product_field、spec_table 或 json_ld。sourceType 必须保留，禁止把 vision 改成 page field。',
      '只输出 JSON：{"summary":"","identity":{"name":"","confidence":0},"facts":[{"label":"","value":"","status":"","sourceType":"","sourceRef":"","note":""}],"diagnosis":{"strengths":[],"issues":[],"priorities":[]},"keywordStrategy":{"primary":[],"secondary":[],"blocked":[],"rationale":[]},"contentBrief":{"titleGoals":[],"detailGoals":[],"faqGoals":[],"geoGoals":[]}}',
    ].join('\n')
  }

  ns.bg.diagnosisPrompt = { systemPrompt: systemPrompt }
})(typeof globalThis !== 'undefined' ? globalThis : self)
