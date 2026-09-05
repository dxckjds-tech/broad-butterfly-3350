;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}
  const { esc, arr } = ns.sidepanel.ui

  /**
   * @param {{report: AnalysisResult}} props
   */
  function keywords(props) {
    const r = props.report || {}
    const k = r.keywords || {}
    return `<div><div class="section-label">当前关键词</div>${
      arr(k.current)
        .map((x) => `<span class="chip">${esc(x)}</span>`)
        .join('') || '<div class="card card-na">未读取到</div>'
    }</div><div><div class="section-label">已拦截</div>${
      arr(k.blocked)
        .map((x) => `<div class="card card-blocked"><b>${esc(x.keyword)}</b><p>${esc(x.reason)}</p></div>`)
        .join('') || '<div class="card card-ok">无</div>'
    }</div><div><div class="section-label">AI 候选</div>${arr(k.candidates)
      .map(
        (x) =>
          `<div class="card"><div class="summary-line"><b>${esc(x.keyword)}</b><b>${esc(x.matchScore)}</b></div><p>${esc(x.intent)} · ${esc(x.basis)}</p></div>`,
      )
      .join('')}</div>`
  }

  ns.sidepanel.render.keywords = keywords
})(typeof globalThis !== 'undefined' ? globalThis : self)
