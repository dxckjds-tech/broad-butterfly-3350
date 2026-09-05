;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}
  const { esc, arr, translateButton } = ns.sidepanel.ui

  function detailView(detail) {
    if (!detail) return '<div class="card card-na">暂无可用详情内容</div>'
    if (typeof detail === 'string')
      return `<div class="card english-card"><p class="preserve-lines">${esc(detail)}</p>${translateButton(detail)}</div>`
    const specs = arr(detail.specifications),
      highlights = arr(detail.highlights),
      applications = arr(detail.applications)
    const overview = [detail.headline, detail.overview].filter(Boolean).join('\n')
    const highlightText = ['Key Highlights', ...highlights.map((x) => '• ' + x)].join('\n')
    const specText = ['Technical Specifications', ...specs.map((x) => `${x.name}: ${x.value}`)].join('\n')
    const applicationText = ['Applications', ...applications.map((x) => '• ' + x)].join('\n')
    const copyText = [
      overview,
      highlights.length ? highlightText : '',
      specs.length ? specText : '',
      applications.length ? applicationText : '',
      detail.packagingDelivery ? `Packaging & Delivery\n${detail.packagingDelivery}` : '',
      detail.buyerNote ? `Buyer Note\n${detail.buyerNote}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    return `<div class="detail-layout">${detail.headline ? `<div class="detail-hero"><span>PRODUCT OVERVIEW</span><h2>${esc(detail.headline)}</h2><p>${esc(detail.overview)}</p>${translateButton(overview)}</div>` : ''}${highlights.length ? `<div class="card english-card"><h3>Key Highlights</h3><ul class="highlight-list">${highlights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${translateButton(highlightText)}</div>` : ''}${specs.length ? `<div class="card english-card"><h3>Technical Specifications</h3><div class="spec-table">${specs.map((x) => `<div class="spec-row"><b>${esc(x.name)}</b><span>${esc(x.value)}</span></div>`).join('')}</div>${translateButton(specText)}</div>` : ''}${applications.length ? `<div class="card english-card"><h3>Applications</h3><div class="application-grid">${applications.map((x) => `<span>${esc(x)}</span>`).join('')}</div>${translateButton(applicationText)}</div>` : ''}${detail.packagingDelivery ? `<div class="card detail-info english-card"><h3>Packaging & Delivery</h3><p>${esc(detail.packagingDelivery)}</p>${translateButton(detail.packagingDelivery)}</div>` : ''}${detail.buyerNote ? `<div class="card detail-note english-card"><h3>Buyer Note</h3><p>${esc(detail.buyerNote)}</p>${translateButton(detail.buyerNote)}</div>` : ''}<button class="copy detail-copy" data-action="copy" data-text="${esc(copyText)}">复制完整详情</button></div>`
  }

  function geoView(geo) {
    if (!geo || geo === 'NOT_AVAILABLE')
      return '<div class="card card-na"><b>当前证据不足</b><p>请补充产品或公司信息后重新分析，系统不会编造 GEO 内容。</p></div>'
    if (typeof geo === 'string')
      return `<div class="card english-card"><p class="preserve-lines">${esc(geo)}</p>${translateButton(geo)}</div>`
    const facts = arr(geo.productFacts),
      questions = arr(geo.buyerQuestions),
      guidance = arr(geo.sourcingGuidance),
      evidence = arr(geo.evidenceBasis)
    const allText = [
      geo.headline,
      geo.directAnswer,
      facts.join('\n'),
      geo.companyContext,
      questions.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join('\n\n'),
      guidance.join('\n'),
      evidence.join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n')
    return `<div class="geo-layout">${geo.headline ? `<div class="detail-hero"><span>AI-READY PRODUCT ANSWER</span><h2>${esc(geo.headline)}</h2><p>${esc(geo.directAnswer)}</p>${translateButton([geo.headline, geo.directAnswer].join('\n'))}</div>` : ''}${facts.length ? `<div class="card english-card"><h3>Verified Product Facts</h3><ul class="highlight-list">${facts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${translateButton(facts.join('\n'))}</div>` : ''}${geo.companyContext ? `<div class="card english-card geo-company"><h3>Supplier Context</h3><p>${esc(geo.companyContext)}</p>${translateButton(geo.companyContext)}</div>` : ''}${questions
      .map((x) => {
        const text = `Q: ${x.question}\nA: ${x.answer}`
        return `<div class="card english-card"><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p>${translateButton(text)}</div>`
      })
      .join(
        '',
      )}${guidance.length ? `<div class="card english-card detail-note"><h3>Sourcing Guidance</h3><ul class="highlight-list">${guidance.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${translateButton(guidance.join('\n'))}</div>` : ''}${evidence.length ? `<details class="card geo-evidence"><summary>Evidence Basis</summary>${evidence.map((x) => `<p>• ${esc(x)}</p>`).join('')}</details>` : ''}<button class="copy detail-copy" data-action="copy" data-text="${esc(allText)}">复制完整 GEO 文案</button></div>`
  }

  /**
   * @param {{report: AnalysisResult, subtab: number}} props
   */
  function content(props) {
    const r = props.report || {}
    const subtab = props.subtab || 0
    const c = r.content || {},
      names = ['标题', '详情', 'FAQ', 'GEO']
    let body = ''
    if (subtab === 0)
      body = arr(c.titles)
        .map(
          (x) =>
            `<div class="card english-card"><b>${esc(x.style)}</b><p>${esc(x.text)}</p><small>采用：${esc(arr(x.factsUsed).join('、'))}<br>排除：${esc(arr(x.excluded).join('、'))}</small><div class="card-actions"><button class="copy" data-action="copy" data-text="${esc(x.text)}">复制</button>${translateButton(x.text)}</div></div>`,
        )
        .join('')
    else if (subtab === 1) body = detailView(c.detail)
    else if (subtab === 2)
      body = arr(c.faq)
        .map((x) => {
          const text = `Q: ${x.question}\nA: ${x.answer}`
          return `<div class="card english-card"><b>Q：${esc(x.question)}</b><p>A：${esc(x.answer)}</p>${translateButton(text)}</div>`
        })
        .join('')
    else body = geoView(c.geo)
    return `<div class="subtabs">${names.map((x, i) => `<button class="subtab-btn ${subtab === i ? 'active' : ''}" data-action="subtab" data-i="${i}">${x}</button>`).join('')}</div>${body}`
  }

  ns.sidepanel.render.content = content
})(typeof globalThis !== 'undefined' ? globalThis : self)
