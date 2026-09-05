;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}
  const { esc, arr } = ns.sidepanel.ui

  /**
   * @param {{report: AnalysisResult}} props
   */
  function overview(props) {
    const r = props.report || {}
    const s = r.summary || {}
    const meta = props.meta || {}
    const orch = meta.orchestration || r.debug && r.debug.orchestration
    const lines = meta.collaboration || []
    const orchCard =
      orch || lines.length
        ? `<div class="card"><div class="section-label">本次 AI 协同</div>${
            lines.length
              ? lines.map(function (item) { return `<p>${esc(item)}</p>` }).join('')
              : `<p>${esc(orch && orch.mode === 'single' ? '单模型诊断' : '多模型协同')}</p>`
          }</div>`
        : ''
    return orchCard + `<div class="card"><div class="section-label">AI 诊断</div>${
      arr(s.conflicts).length
        ? arr(s.conflicts)
            .map((x) => `<p class="danger">⚠ ${esc(x)}</p>`)
            .join('')
        : '<p class="success">未发现明确冲突</p>'
    }</div><div class="card"><b>下一步建议</b>${arr(s.nextActions)
      .map((x) => `<p>• ${esc(x)}</p>`)
      .join('')}</div>`
  }

  ns.sidepanel.render.overview = overview
})(typeof globalThis !== 'undefined' ? globalThis : self)
