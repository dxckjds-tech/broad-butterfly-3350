;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}
  const { esc, arr } = ns.sidepanel.ui

  /**
   * @param {{report: AnalysisResult, fields: ProductFields, meta: CallMeta}} props
   */
  function debug(props) {
    const r = props.report || {}
    const fields = props.fields
    const meta = props.meta
    const d = r.debug || {}
    return `<div class="card"><b>真实页面读取</b><p>标题：${fields?.title ? '已读取' : '未读取'}</p><p>类目：${fields?.category ? '已读取' : '未读取'}</p><p>规格/表格：${arr(fields?.specs).length} 条</p><p>表单字段：${arr(fields?.formFields).length} 条</p><p>页面/框架：${fields?.frameCount || 1} 个</p><p>正文证据：${fields?.visibleText?.length || 0} 字符</p><p>图片：${arr(fields?.images).length} 张</p></div><div class="card"><b>API 调用</b><p>提供商：${esc(meta?.provider || '—')}</p><p>模型：${esc(meta?.model || '—')}</p><p>请求次数：${esc(meta?.attempts || 1)}</p><p>Token：${esc(meta?.usage?.total_tokens || '—')}</p><p>读取地址：${esc(fields?.url || '—')}</p></div><div class="card"><b>缺失字段</b>${
      arr(d.missingFields)
        .map((x) => `<p>• ${esc(x)}</p>`)
        .join('') || '<p>无</p>'
    }</div><div class="card"><b>警告</b>${
      arr(d.warnings)
        .map((x) => `<p class="danger">• ${esc(x)}</p>`)
        .join('') || '<p>无</p>'
    }</div>`
  }

  ns.sidepanel.render.debug = debug
})(typeof globalThis !== 'undefined' ? globalThis : self)
