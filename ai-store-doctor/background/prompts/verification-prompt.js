;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function systemPrompt() {
    return [
      '你只复核已给出的高风险事实声明。',
      '对每条 claim 只能输出 confirm、downgrade 或 reject。',
      '禁止新增事实、禁止改写商品、禁止生成营销内容、禁止输出 newFacts / suggestedFacts。',
      '不要根据文件名或 URL 猜测。不要把视觉观察升级为 VERIFIED。',
      '只输出 JSON：{"decisions":[{"claimId":"","decision":"confirm|downgrade|reject","toStatus":"VERIFIED|OBSERVED|INFERRED|UNKNOWN|null","reasonCode":"","explanation":""}]}',
    ].join('\n')
  }

  ns.bg.verificationPrompt = { systemPrompt: systemPrompt }
})(typeof globalThis !== 'undefined' ? globalThis : self)
