;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}
  const { esc, badge, arr } = ns.sidepanel.ui

  /**
   * @param {{report: AnalysisResult, manualIdentityDraft?: string}} props
   */
  function truth(props) {
    const r = props.report || {}
    const draft = props.manualIdentityDraft || ''
    return `<div class="section-label">视觉与字段身份候选</div>${arr(r.identityCandidates)
      .map(
        (x) =>
          `<div class="card"><div class="summary-line"><b>${esc(x.name)}</b><b>${esc(x.confidence)}%</b></div>${arr(
            x.support,
          )
            .map((v) => `<p class="success">✓ ${esc(v)}</p>`)
            .join('')}${arr(x.oppose)
            .map((v) => `<p class="danger">✕ ${esc(v)}</p>`)
            .join(
              '',
            )}<button class="identity-confirm" data-action="confirm-identity" data-name="${esc(x.name)}">确认是此产品</button></div>`,
      )
      .join(
        '',
      )}<div class="card manual-identity"><b>以上都不符合</b><input id="manualIdentity" placeholder="输入正确的英文商品身份" value="${esc(draft)}"><button data-action="confirm-manual-identity">确认并重新分析</button></div><div class="section-label">事实台账</div>${arr(
      r.facts,
    )
      .map(
        (x) =>
          `<div class="card fact"><div><b>${esc(x.label)}</b>：${esc(x.value)}</div>${badge(x.status)}<small>${esc(x.source)} · ${esc(x.note)}</small></div>`,
      )
      .join('')}`
  }

  ns.sidepanel.render.truth = truth
})(typeof globalThis !== 'undefined' ? globalThis : self)
