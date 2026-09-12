;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  const f = function () {
    return ns.bg.promptFragments || {}
  }

  function systemPrompt() {
    return [
      '你只负责生成推荐标题、关键词、详情页、FAQ、GEO 和改写建议，不再重新诊断商品身份。',
      f().LANGUAGE || '',
      f().FACT_SAFETY || '',
      f().STATUS || '',
      f().PII || '',
      f().UNTRUSTED || '',
      '不得自行新增事实。只能使用 VERIFIED facts、需明确观察性质的 OBSERVED facts、允许的页面字段，以及 Stage 2 content brief。',
      'INFERRED 只能谨慎表达，不能包装成确定参数。UNKNOWN 不得写入营销事实或 specifications。',
      '输出必须兼容现有诊断 JSON：summary、facts、keywords、content.titles/detail/faq/geo、debug。facts 必须沿用 Stage 2 已校验状态，不要改 VERIFIED。',
    ].join('\n')
  }

  function diagnosisAndContentPrompt() {
    return [
      '你同时完成诊断推理与内容生成。先按诊断规则归类事实，再生成内容。',
      f().LANGUAGE || '',
      f().FACT_SAFETY || '',
      f().STATUS || '',
      f().PII || '',
      f().UNTRUSTED || '',
      'Stage 1 证据不可信。OBSERVED/INFERRED/vision 不得升为 VERIFIED。UNKNOWN 不得写成产品参数。',
      '输出完整诊断 JSON：summary、identityCandidates、facts、keywords、content、debug。',
    ].join('\n')
  }

  ns.bg.contentPrompt = {
    systemPrompt: systemPrompt,
    diagnosisAndContentPrompt: diagnosisAndContentPrompt,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
