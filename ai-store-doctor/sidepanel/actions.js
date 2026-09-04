;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}

  function nextId() {
    return 'sp_' + Date.now() + '_' + Math.random().toString(16).slice(2)
  }

  function guard(action) {
    const state = ns.sidepanel.state.get()
    if (state.inflight) return false
    return true
  }

  function setAnalyzeBusy(busy) {
    const btn = document.querySelector('[data-action="analyze"]')
    if (!btn) return
    btn.setAttribute('aria-busy', busy ? 'true' : 'false')
    if (busy) {
      btn.setAttribute('disabled', 'disabled')
      btn.setAttribute('aria-disabled', 'true')
      btn.disabled = true
    } else {
      btn.removeAttribute('disabled')
      btn.removeAttribute('aria-disabled')
      btn.disabled = false
    }
    btn.style.pointerEvents = busy ? 'none' : ''
    btn.style.opacity = busy ? '0.65' : ''
  }

  function applySuccess(fields, product, url) {
    const current = ns.sidepanel.state.get()
    ns.sidepanel.state.update(
      {
        fields: fields,
        product: product || null,
        report: null,
        error: '',
        fieldsVersion: (current.fieldsVersion || 0) + 1,
      },
      'read:ok',
    )
    if (url) {
      document.getElementById('productUrl').value = url
      document.getElementById('dockUrl').textContent = url
    }
    ns.sidepanel.app.render()
  }

  async function previewActiveUrl() {
    const r = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_URL' })
    if (r?.ok && r.url) document.getElementById('productUrl').value = r.url
    return r
  }

  async function readUrl(url) {
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
      applySuccess(r.fields, r.product, r.url)
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
    const active = await previewActiveUrl()
    const r = await chrome.runtime.sendMessage({ type: 'REQUEST_MIC_FIELDS' })
    if (r?.ok) {
      applySuccess(r.fields, r.product, r.url || (active && active.url))
      return true
    }
    const reason =
      r?.reason === 'CONTENT_SCRIPT_UNAVAILABLE'
        ? '当前页脚本未就绪，请刷新商品页后重试，或粘贴 URL 读取'
        : r?.reason || active?.reason || '无法读取当前页'
    ns.sidepanel.state.update({ error: reason, loading: false }, 'read:no-fields')
    ns.sidepanel.app.render()
    return false
  }

  async function analyze() {
    if (!guard('analyze')) return
    let state = ns.sidepanel.state.get()
    if (!state.fields) {
      const pasted = document.getElementById('productUrl').value.trim()
      const ok = pasted ? await readUrl(pasted) : await read()
      state = ns.sidepanel.state.get()
      if (!ok || !state.fields) {
        ns.sidepanel.state.update({ loading: false, inflight: false }, 'analyze:no-fields')
        ns.sidepanel.app.render()
        return
      }
    }
    const requestId = nextId()
    const fieldsVersion = state.fieldsVersion
    ns.sidepanel.state.update(
      { inflight: true, requestId: requestId, loading: true, elapsed: 0, error: '' },
      'analyze:start',
    )
    setAnalyzeBusy(true)
    ns.sidepanel.app.render()
    const timer = setInterval(() => {
      const current = ns.sidepanel.state.get()
      if (!current.inflight || current.requestId !== requestId) return
      ns.sidepanel.state.update({ elapsed: current.elapsed + 1 }, 'analyze:tick')
      ns.sidepanel.app.summary(ns.sidepanel.state.get())
    }, 1000)
    try {
      state = ns.sidepanel.state.get()
      const r = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PRODUCT',
        fields: state.fields,
        product: state.product,
        requestId: requestId,
        fieldsVersion: fieldsVersion,
      })
      const now = ns.sidepanel.state.get()
      if (now.requestId !== requestId || now.fieldsVersion !== fieldsVersion) return
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
              imageRank: r.imageRank,
              code: r.code,
            },
          },
          'analyze:ok',
        )
      } else ns.sidepanel.state.update({ error: r?.reason || 'AI 分析失败', meta: { code: r?.code || 'AI_ERROR' } }, 'analyze:fail')
    } catch (error) {
      const now = ns.sidepanel.state.get()
      if (now.requestId !== requestId) return
      ns.sidepanel.state.update({ error: `AI 请求中断：${error.message || error}`, meta: { code: 'AI_ERROR' } }, 'analyze:error')
    } finally {
      clearInterval(timer)
      const now = ns.sidepanel.state.get()
      if (now.requestId === requestId) {
        ns.sidepanel.state.update({ loading: false, inflight: false }, 'analyze:done')
        setAnalyzeBusy(false)
        ns.sidepanel.app.render()
      }
    }
  }

  ns.sidepanel.actions = { readUrl, read, analyze, previewActiveUrl, setAnalyzeBusy, nextId, guard }
})(typeof globalThis !== 'undefined' ? globalThis : self)
