;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}

  async function readUrl(url) {
    const state = ns.sidepanel.state.get()
    ns.sidepanel.state.update({ error: '', report: null, loading: false }, 'readUrl:start')
    if (!url) {
      ns.sidepanel.state.update({ fields: null, product: null, error: '请先粘贴完整商品 URL' }, 'readUrl:empty')
      ns.sidepanel.app.render()
      return false
    }
    document.getElementById('dockUrl').textContent = '正在通过登录会话读取 URL…'
    ns.sidepanel.app.render()
    const r = await chrome.runtime.sendMessage({ type: 'REQUEST_URL_FIELDS', url })
    if (r?.ok) {
      ns.sidepanel.state.update({ fields: r.fields, product: r.product || null }, 'readUrl:ok')
      document.getElementById('productUrl').value = r.url
      document.getElementById('dockUrl').textContent = r.url
      ns.sidepanel.app.render()
      return true
    }
    ns.sidepanel.state.update({ fields: null, product: null, error: r?.reason || 'URL 读取失败' }, 'readUrl:fail')
    document.getElementById('dockUrl').textContent = r?.loginRequired
      ? '需要登录'
      : `URL 读取失败：${r?.reason || '未知错误'}`
    ns.sidepanel.app.render()
    return false
  }

  async function read() {
    const r = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_URL' })
    if (r?.ok) {
      document.getElementById('productUrl').value = r.url
      return await readUrl(r.url)
    }
    ns.sidepanel.state.update({ error: r?.reason || '无法取得当前页 URL', loading: false }, 'read:no-url')
    ns.sidepanel.app.render()
    return false
  }

  async function analyze() {
    let state = ns.sidepanel.state.get()
    if (!state.fields) {
      const ok = await readUrl(document.getElementById('productUrl').value.trim())
      state = ns.sidepanel.state.get()
      if (!ok || !state.fields) {
        ns.sidepanel.state.update({ loading: false }, 'analyze:no-fields')
        ns.sidepanel.app.render()
        return
      }
    }
    ns.sidepanel.state.update({ loading: true, elapsed: 0, error: '' }, 'analyze:start')
    ns.sidepanel.app.render()
    const timer = setInterval(() => {
      const current = ns.sidepanel.state.get()
      ns.sidepanel.state.update({ elapsed: current.elapsed + 1 }, 'analyze:tick')
      ns.sidepanel.app.summary(ns.sidepanel.state.get())
    }, 1000)
    try {
      state = ns.sidepanel.state.get()
      const r = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PRODUCT',
        fields: state.fields,
        product: state.product,
      })
      if (r?.ok) {
        ns.sidepanel.state.update(
          {
            report: r.result,
            meta: {
              provider: r.provider,
              model: r.model,
              usage: r.usage,
              attempts: r.attempts,
              visionUsed: r.visionUsed,
            },
          },
          'analyze:ok',
        )
      } else ns.sidepanel.state.update({ error: r?.reason || 'AI 分析失败' }, 'analyze:fail')
    } catch (error) {
      ns.sidepanel.state.update({ error: `AI 请求中断：${error.message || error}` }, 'analyze:error')
    } finally {
      clearInterval(timer)
      ns.sidepanel.state.update({ loading: false }, 'analyze:done')
      ns.sidepanel.app.render()
    }
  }

  ns.sidepanel.actions = { readUrl, read, analyze }
})(typeof globalThis !== 'undefined' ? globalThis : self)
