;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}

  function mount(props) {
    const health = props && props.health
    if (!health) return null
    const el = ns.dom.el
    const dims = health.dimensions || []
    const issues = health.topIssues || []
    const actions = health.topActions || []
    return el(
      'div',
      { class: 'health-wrap' },
      el(
        'div',
        { class: 'card health-card' },
        el('div', { class: 'section-label', text: '商品健康度' }),
        el(
          'div',
          { class: 'health-hero' },
          el('b', { class: 'health-total', text: String(health.total) + ' / 100' }),
          el('span', { class: 'health-label badge badge-' + String(health.level || 'unknown').toLowerCase(), text: health.label || '' }),
        ),
        el(
          'div',
          { class: 'health-dims' },
          dims.map(function (dim) {
            const pct = dim.maxScore ? Math.round((dim.score / dim.maxScore) * 100) : 0
            return el(
              'div',
              { class: 'health-dim' },
              el(
                'div',
                { class: 'metric-row' },
                el('span', { text: dim.name }),
                el('span', { text: String(dim.score) + ' / ' + String(dim.maxScore) }),
              ),
              el('div', { class: 'bar' }, el('div', { class: 'bar-fill', style: 'width:' + pct + '%;background:var(--teal)' })),
            )
          }),
        ),
      ),
      issues.length
        ? el(
            'div',
            { class: 'card' },
            el('div', { class: 'section-label', text: '最需要优先解决的问题' }),
            issues.map(function (text, i) {
              return el('p', { text: String(i + 1) + '. ' + text })
            }),
          )
        : null,
      actions.length
        ? el(
            'div',
            { class: 'card' },
            el('div', { class: 'section-label', text: '优先优化动作' }),
            actions.map(function (text, i) {
              return el('p', { text: String(i + 1) + '. ' + text })
            }),
          )
        : null,
    )
  }

  ns.sidepanel.render.health = { mount: mount }
})(typeof globalThis !== 'undefined' ? globalThis : self)
