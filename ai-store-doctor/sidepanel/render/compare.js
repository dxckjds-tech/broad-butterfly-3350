;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}

  function copyBtn(label, text) {
    if (!text) return null
    return ns.dom.el('button', { class: 'copy', 'data-action': 'copy', 'data-text': text, text: label })
  }

  function lineList(items, emptyText) {
    const el = ns.dom.el
    if (!items || !items.length) return el('p', { class: 'muted', text: emptyText || '无' })
    return el(
      'div',
      items.map(function (item) {
        return el('p', { text: '• ' + item })
      }),
    )
  }

  function tokenLine(parts) {
    const el = ns.dom.el
    if (!parts || !parts.length) return el('p', { class: 'muted', text: '—' })
    return el(
      'p',
      { class: 'diff-tokens' },
      parts.map(function (part) {
        const cls = part.type === 'added' ? 'diff-add' : part.type === 'removed' ? 'diff-del' : 'diff-same'
        return el('span', { class: cls, text: part.text + ' ' })
      }),
    )
  }

  function faqText(faq) {
    return (faq || [])
      .map(function (item) {
        return 'Q: ' + (item.question || '') + '\nA: ' + (item.answer || '')
      })
      .join('\n\n')
  }

  function geoText(geo) {
    if (!geo || typeof geo !== 'object') return ''
    const bits = [geo.headline, geo.directAnswer, geo.companyContext]
    if (Array.isArray(geo.buyerQuestions)) {
      geo.buyerQuestions.forEach(function (item) {
        bits.push((item.question || '') + ' ' + (item.answer || ''))
      })
    }
    return bits.filter(Boolean).join('\n')
  }

  function detailText(detail) {
    if (!detail) return ''
    if (typeof detail === 'string') return detail
    const chunks = []
    if (detail.overview) chunks.push(detail.overview)
    if (Array.isArray(detail.highlights)) chunks.push(detail.highlights.join('\n'))
    if (Array.isArray(detail.specifications)) {
      chunks.push(
        detail.specifications
          .map(function (row) {
            return (row.name || '') + ': ' + (row.value || '')
          })
          .join('\n'),
      )
    }
    if (Array.isArray(detail.applications)) chunks.push(detail.applications.join('\n'))
    if (detail.packagingDelivery) chunks.push(detail.packagingDelivery)
    return chunks.filter(Boolean).join('\n\n')
  }

  function mount(props) {
    if (!ASD.diff) return null
    const el = ns.dom.el
    const bundle = props.product || {}
    const current = bundle.current || {}
    const report = props.report || {}
    const content = report.content || {}
    const titleNow = current.title || (props.fields && props.fields.title) || ''
    const suggestedTitle = (content.titles && content.titles[0] && content.titles[0].text) || ''
    const title = ASD.diff.titleDiff(titleNow, suggestedTitle)
    const reasons = ASD.diff.titleReasons(titleNow, suggestedTitle, bundle, report)
    const currentKw = current.keywords || (props.fields && props.fields.keywords) || []
    const suggestedKw = ((report.keywords && report.keywords.candidates) || []).map(function (item) {
      return item.keyword || item
    })
    const keys = ASD.diff.keywordDiff(currentKw, suggestedKw, report.keywords && report.keywords.blocked)
    const descNow = current.description || (props.fields && props.fields.description) || ''
    const details = ASD.diff.detailDiff(descNow, content.detail || {})
    const faq = Array.isArray(content.faq) ? content.faq : []
    const geo = content.geo || null

    return el(
      'div',
      { class: 'compare-wrap' },
      el('div', { class: 'section-label', text: '当前内容 VS AI建议' }),
      el(
        'div',
        { class: 'card' },
        el('b', { text: '当前标题' }),
        el('p', { text: title.current || '（空）' }),
        el('b', { text: 'AI建议' }),
        el('p', { text: title.suggested || '（空）' }),
        tokenLine(title.parts),
        el('div', { class: 'section-label', text: '修改理由' }),
        lineList(reasons, '暂无有证据的修改理由'),
        copyBtn('复制推荐标题', title.suggested),
      ),
      el(
        'div',
        { class: 'card' },
        el('b', { text: '关键词' }),
        el('p', { class: 'muted', text: '保留' }),
        lineList(keys.kept, '无'),
        el('p', { class: 'muted', text: '建议新增' }),
        lineList(keys.added, '无'),
        el('p', { class: 'muted', text: '不建议继续使用' }),
        lineList(keys.blocked.concat(keys.removed), '无'),
        copyBtn('复制推荐关键词', suggestedKw.join('\n')),
      ),
      el(
        'div',
        { class: 'card' },
        el('b', { text: '产品详情' }),
        el('p', { class: 'muted', text: '当前详情' }),
        details.emptyCurrent
          ? el('p', { class: 'muted', text: '当前未配置' })
          : details.current.map(function (p) {
              return el('p', { class: 'preserve-lines', text: p })
            }),
        el('p', { class: 'muted', text: 'AI建议结构' }),
        details.emptySuggested
          ? el('p', { class: 'muted', text: '暂无 AI 详情建议' })
          : details.suggested.map(function (sec) {
              return el('div', el('b', { text: sec.heading }), el('p', { class: 'preserve-lines', text: sec.text }))
            }),
        copyBtn('复制推荐详情', detailText(content.detail)),
      ),
      el(
        'div',
        { class: 'card' },
        el('b', { text: 'FAQ' }),
        el('p', { class: 'muted', text: '当前：未检测到FAQ' }),
        el('p', { class: 'muted', text: faq.length ? '建议：新增以下FAQ' : '建议：暂无 FAQ' }),
        faq.map(function (item) {
          return el('p', { text: 'Q: ' + (item.question || '') + '  A: ' + (item.answer || '') })
        }),
        copyBtn('复制FAQ', faqText(faq)),
      ),
      el(
        'div',
        { class: 'card' },
        el('b', { text: 'GEO' }),
        el('p', { class: 'muted', text: '当前：未检测到GEO' }),
        geo && (geo.headline || geo.directAnswer)
          ? el('div', el('p', { text: geo.headline || '' }), el('p', { text: geo.directAnswer || '' }))
          : el('p', { class: 'muted', text: '建议：暂无 GEO' }),
        copyBtn('复制GEO', geoText(geo)),
      ),
    )
  }

  ns.sidepanel.render.compare = { mount: mount }
})(typeof globalThis !== 'undefined' ? globalThis : self)
