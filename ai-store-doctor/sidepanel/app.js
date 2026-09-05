;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}
  const { esc, badge } = ns.sidepanel.ui

  function captureManualDraft() {
    const input = document.getElementById('manualIdentity')
    if (input) ns.sidepanel.state.update({ manualIdentityDraft: input.value }, 'capture-manual')
  }

  function summary(props) {
    const e = document.getElementById('summary')
    if (props.loading)
      e.innerHTML = `<b>AI 正在分析… ${props.elapsed} 秒</b><div class="loader"></div><div class="muted">K3 推理可能需要 60–125 秒，其他模型通常 10–40 秒</div>`
    else if (props.error)
      e.innerHTML = `<div class="danger">${esc(props.error)}</div><button class="pill-btn" data-action="settings">打开 API 设置</button>`
    else if (!props.report) e.innerHTML = '<b>读取商品 URL 后，点击“AI 分析商品”</b>'
    else {
      const s = props.report.summary || {}
      e.innerHTML = `<div class="summary-line"><b>${esc(s.identity || '身份待确认')}</b><b class="teal">${esc(s.confidence || 0)}%</b></div><div>${badge(s.status)}</div><div class="muted">数据完整度 ${esc(s.dataCompleteness || 0)} · 内容就绪度 ${esc(s.contentReadiness || 0)}</div>`
    }
  }

  function tabs(props) {
    const x = ['概览', '商品真相', '关键词', '内容优化', '证据与调试']
    document.getElementById('tabs').innerHTML = x
      .map(
        (n, i) =>
          `<button class="tab-btn ${props.tab === i ? 'active' : ''}" data-action="tab" data-i="${i}">${n}</button>`,
      )
      .join('')
  }

  function render() {
    captureManualDraft()
    const props = ns.sidepanel.state.get()
    summary(props)
    tabs(props)
    const c = document.getElementById('content')
    if (!props.report)
      c.innerHTML = props.fields
        ? '<div class="card">商品 URL 数据已读取。点击下方按钮调用所选 AI 完成诊断。</div>'
        : '<div class="card">请粘贴商品 URL，或读取当前页 URL。</div>'
    else {
      const views = [
        ns.sidepanel.render.overview,
        ns.sidepanel.render.truth,
        ns.sidepanel.render.keywords,
        ns.sidepanel.render.content,
        ns.sidepanel.render.debug,
      ]
      const html = views[props.tab](props)
      c.innerHTML = html
      if (props.tab === 0 && ns.sidepanel.render.health) {
        const healthNode = ns.sidepanel.render.health.mount(props)
        if (healthNode) c.insertBefore(healthNode, c.firstChild)
      }
    }
  }

  ns.sidepanel.app = { render, summary, tabs }

  document.getElementById('panel').addEventListener('click', async (e) => {
    const x = e.target.closest('[data-action]')
    if (!x) return
    if (x.dataset.action === 'tab') ns.sidepanel.state.update({ tab: Number(x.dataset.i) }, 'tab')
    else if (x.dataset.action === 'subtab') ns.sidepanel.state.update({ subtab: Number(x.dataset.i) }, 'subtab')
    else if (x.dataset.action === 'settings') {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })
      return
    } else if (x.dataset.action === 'read-url') {
      await ns.sidepanel.actions.readUrl(document.getElementById('productUrl').value.trim())
      return
    } else if (x.dataset.action === 'reload-fields') {
      await ns.sidepanel.actions.read()
      return
    } else if (x.dataset.action === 'analyze') {
      await ns.sidepanel.actions.analyze()
      return
    } else if (x.dataset.action === 'confirm-identity') {
      const state = ns.sidepanel.state.get()
      if (state.fields) state.fields.userConfirmedIdentity = x.dataset.name
      await ns.sidepanel.actions.analyze()
      return
    } else if (x.dataset.action === 'confirm-manual-identity') {
      const name = document.getElementById('manualIdentity')?.value.trim()
      if (name) {
        const state = ns.sidepanel.state.get()
        if (state.fields) state.fields.userConfirmedIdentity = name
        await ns.sidepanel.actions.analyze()
      }
      return
    } else if (x.dataset.action === 'translate') {
      const original = x.textContent
      x.disabled = true
      x.textContent = '翻译中…'
      const result = await chrome.runtime
        .sendMessage({ type: 'TRANSLATE_TEXT', text: decodeURIComponent(x.dataset.text) })
        .catch((error) => ({ ok: false, reason: error.message }))
      x.disabled = false
      x.textContent = original
      let box = x.closest('.english-card,.detail-hero,.card')
      let translated = box.querySelector('.translation-result')
      if (!translated) {
        translated = document.createElement('div')
        translated.className = 'translation-result'
        box.appendChild(translated)
      }
      translated.textContent =
        result?.ok && result.translation ? result.translation : `翻译失败：${result?.reason || '未知错误'}`
      return
    } else if (x.dataset.action === 'copy') {
      await navigator.clipboard.writeText(x.dataset.text)
      x.textContent = '已复制'
      return
    }
    render()
  })
  document.getElementById('productUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ns.sidepanel.actions.readUrl(e.currentTarget.value.trim())
  })
  render()
  ns.sidepanel.actions.previewActiveUrl()
})(typeof globalThis !== 'undefined' ? globalThis : self)
