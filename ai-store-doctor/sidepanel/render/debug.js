;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}
  const { esc, arr } = ns.sidepanel.ui

  /**
   * @param {{report: AnalysisResult, fields: ProductFields, meta: CallMeta, product?: object}} props
   */
  function debug(props) {
    const r = props.report || {}
    const fields = props.fields
    const meta = props.meta
    const d = r.debug || {}
    const product = props.product
    const dProduct = product && product.debug
    const imageRows = (dProduct && dProduct.imageCandidates) || (meta && meta.imageRank) || []
    const imageCard = imageRows.length
      ? `<div class="card"><b>图片评分</b>${imageRows
          .map(function (img, i) {
            return `<p>${i + 1}. ${esc(img.score || 0)} · ${esc(img.src || '')} · ${esc((img.reasons || []).join(', '))}</p>`
          })
          .join('')}</div>`
      : ''
    const hits = dProduct && dProduct.selectorHits
    const hitsCard = hits
      ? `<div class="card"><b>Selector Hits</b><p>title：${esc(hits.title || 'null')}</p><p>category：${esc(hits.category || 'null')}</p><p>keywords：${esc(hits.keywords || 'null')}</p><p>description：${esc(hits.description || 'null')}</p><p>specifications：${esc(hits.specifications || 'null')}</p><p>company：${esc(hits.company || 'null')}</p><p>productRoot：${esc(hits.productRoot || 'null')}</p></div>`
      : ''
    const perfCard =
      dProduct && (dProduct.finalQualityScore != null || dProduct.qualityScore != null)
        ? `<div class="card"><b>采集性能</b><p>quality：${esc(dProduct.finalQualityScore != null ? dProduct.finalQualityScore : dProduct.qualityScore)}</p><p>sampleCount：${esc(dProduct.sampleCount || 0)}</p><p>observerTriggered：${esc(dProduct.observerTriggeredCount || 0)}</p><p>readDurationMs：${esc(dProduct.readDurationMs || 0)}</p></div>`
        : ''
    const route = meta && meta.route
    const orch = meta && meta.orchestration
    const orchCard = orch
      ? `<div class="card"><b>协同编排</b><p>模式：${esc(orch.mode || '—')}</p><p>调用次数：${esc(orch.totalCalls || '—')}</p><p>耗时：${esc(orch.totalDurationMs || '—')} ms</p>${
          arr(orch.stages)
            .map(function (item) {
              return `<p>• ${esc(item.stage || item.id)}：${esc(item.provider)} / ${esc(item.model)} · ${esc(item.durationMs || '—')}ms${item.fallbackUsed ? ' · fallback' : ''}</p>`
            })
            .join('')
        }${arr(meta.collaboration).map(function (item) { return `<p>${esc(item)}</p>` }).join('')}</div>`
      : ''
    const verification = (orch && orch.verification) || (d && d.verification) || null
    const verifyCard = verification
      ? `<div class="card"><b>高风险复核</b><p>riskScore：${esc(verification.riskScore != null ? verification.riskScore : '—')}</p><p>level：${esc(verification.level || '—')}</p><p>triggered：${esc(!!verification.triggered)}</p><p>provider：${esc(verification.provider || '—')}</p><p>model：${esc(verification.model || '—')}</p><p>independentVerification：${esc(verification.independentVerification)}</p><p>confirmed / downgraded / rejected：${esc(verification.confirmed || 0)} / ${esc(verification.downgraded || 0)} / ${esc(verification.rejected || 0)}</p>${
          arr(verification.reasons)
            .map(function (item) {
              return `<p>• ${esc(item)}</p>`
            })
            .join('')
        }</div>`
      : ''
    const routeCard = route
      ? `<div class="card"><b>本次自动选择</b><p>Provider：${esc((route.selected && route.selected.provider) || meta.provider || '—')}</p><p>Model：${esc((route.selected && route.selected.model) || meta.model || '—')}</p><p>评分：${esc((route.selected && route.selected.score) || '—')}</p>${
          arr(route.reason)
            .map(function (item) {
              return `<p>• ${esc(item)}</p>`
            })
            .join('') || '<p class="muted">无解释</p>'
        }</div>`
      : ''
    const payload = (orch && orch.payload) || (d && d.payload) || (meta && meta.payloadDebug) || null
    const payloadCard = payload
      ? `<div class="card"><b>Payload 压缩</b><p>profile：${esc(payload.payloadProfile || '—')}</p><p>originalEstimatedTokens：${esc(payload.originalEstimatedTokens != null ? payload.originalEstimatedTokens : '—')}</p><p>finalEstimatedTokens：${esc(payload.finalEstimatedTokens != null ? payload.finalEstimatedTokens : '—')}</p><p>removedSections：${esc((payload.removedSections || []).join(', ') || '—')}</p><p>imageCount：${esc(payload.imageCountBefore != null ? payload.imageCountBefore : '—')} → ${esc(payload.imageCountAfter != null ? payload.imageCountAfter : '—')}</p></div>`
      : ''
    const collectCompare = dProduct
      ? `<div class="card"><b>采集双轨</b><p>旧结构字段：${esc(dProduct.oldFieldCount || 0)}</p><p>新结构字段：${esc(dProduct.newFieldCount || 0)}</p><p>productRoot：${dProduct.productRootFound ? '已找到' : '未找到'}</p><p>完整商品：${dProduct.completeProduct ? '是' : '否'}</p></div>`
      : ''
    return (
      collectCompare +
      payloadCard +
      orchCard +
      verifyCard +
      routeCard +
      hitsCard +
      perfCard +
      imageCard +
      `<div class="card"><b>真实页面读取</b><p>标题：${fields?.title ? '已读取' : '未读取'}</p><p>类目：${fields?.category ? '已读取' : '未读取'}</p><p>规格/表格：${arr(fields?.specs).length} 条</p><p>表单字段：${arr(fields?.formFields).length} 条</p><p>页面/框架：${fields?.frameCount || 1} 个</p><p>正文证据：${fields?.visibleText?.length || 0} 字符</p><p>图片：${arr(fields?.images).length} 张</p></div><div class="card"><b>API 调用</b><p>提供商：${esc(meta?.provider || '—')}</p><p>模型：${esc(meta?.model || '—')}</p><p>请求次数：${esc(meta?.attempts || 1)}</p><p>Token：${esc(meta?.usage?.total_tokens || '—')}</p><p>读取地址：${esc(fields?.url || '—')}</p></div><div class="card"><b>缺失字段</b>${
        arr(d.missingFields)
          .map((x) => `<p>• ${esc(x)}</p>`)
          .join('') || '<p>无</p>'
      }</div><div class="card"><b>警告</b>${
        arr(d.warnings)
          .map((x) => `<p class="danger">• ${esc(x)}</p>`)
          .join('') || '<p>无</p>'
      }</div>`
    )
  }

  ns.sidepanel.render.debug = debug
})(typeof globalThis !== 'undefined' ? globalThis : self)
