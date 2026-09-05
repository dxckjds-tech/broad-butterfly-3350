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
    const userLines = (orch && orch.userLines) || []
    const statusLines = userLines.length
      ? userLines
      : lines.length
        ? lines
        : orch
          ? [
              orch.mode === 'single' ? '单模型诊断' : 'AI协同完成',
              orch.totalCalls
                ? orch.totalCalls + '次调用 · ' + (((orch.totalDurationMs || 0) / 1000).toFixed(1) + '秒')
                : '',
            ].filter(Boolean)
          : []
    if (orch && orch.verification && orch.verification.triggered && statusLines.indexOf('已对高风险事实进行二次复核') === -1) {
      statusLines.push('已对高风险事实进行二次复核')
    }
    if (orch && orch.verification && orch.verification.downgraded && !statusLines.some(function (item) { return String(item).indexOf('已自动降级') !== -1 })) {
      statusLines.push('发现' + orch.verification.downgraded + '条证据不足内容，已自动降级')
    }
    if (orch && orch.completion && orch.completion.status === 'partial' && statusLines.indexOf('诊断已完成，但部分内容建议生成失败。') === -1) {
      statusLines.push('诊断已完成，但部分内容建议生成失败。')
    }
    const orchCard =
      orch || statusLines.length
        ? `<div class="card"><div class="section-label">本次 AI 协同</div>${
            statusLines.length
              ? statusLines.map(function (item) { return `<p>${esc(item)}</p>` }).join('')
              : `<p>${esc(orch && orch.mode === 'single' ? '单模型诊断' : 'AI协同完成')}</p>`
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
