;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  ns.sidepanel.render = ns.sidepanel.render || {}

  function listView(props) {
    const el = ns.dom.el
    const rows = (props && props.historyList) || []
    return el(
      'div',
      { class: 'history-wrap' },
      el('div', { class: 'section-label', text: '历史诊断' }),
      rows.length
        ? rows.map(function (row) {
            return el(
              'div',
              { class: 'card hist-row' },
              el('b', { text: row.productName || '未命名商品' }),
              el('p', { class: 'muted', text: '健康评分 ' + String(row.healthScore == null ? '—' : row.healthScore) }),
              el('p', { text: row.productIdentity || '身份未记录' }),
              el('p', { class: 'muted', text: String(row.createdAt || '').slice(0, 19).replace('T', ' ') }),
              el(
                'div',
                { class: 'card-actions' },
                el('button', { class: 'pill-btn', 'data-action': 'history-view', 'data-id': row.id, text: '查看' }),
                el('button', { class: 'pill-btn', 'data-action': 'history-reanalyze', 'data-id': row.id, text: '重新分析' }),
                el('button', { class: 'pill-btn', 'data-action': 'history-delete', 'data-id': row.id, text: '删除' }),
              ),
            )
          })
        : el('div', { class: 'card', text: '还没有保存的诊断。分析完成后点击“保存诊断”。' }),
    )
  }

  function banner(record) {
    const el = ns.dom.el
    if (!record) return null
    return el(
      'div',
      { class: 'card hist-banner' },
      el('b', { text: '正在查看历史诊断' }),
      el('p', { class: 'muted', text: (record.productName || '') + ' · ' + String(record.createdAt || '').slice(0, 10) }),
      el('button', { class: 'pill-btn', 'data-action': 'history-back', text: '返回当前分析' }),
    )
  }

  ns.sidepanel.render.history = { listView: listView, banner: banner }
})(typeof globalThis !== 'undefined' ? globalThis : self)
