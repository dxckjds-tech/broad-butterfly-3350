;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  async function readUrlInAuthenticatedTab(targetUrl) {
    let url
    try {
      url = new URL(targetUrl)
    } catch {
      return { ok: false, reason: '商品 URL 格式不正确' }
    }
    const supported =
      url.protocol === 'https:' &&
      (url.hostname === 'made-in-china.com' ||
        url.hostname.endsWith('.made-in-china.com') ||
        url.hostname === 'vemic.com' ||
        url.hostname.endsWith('.vemic.com'))
    if (!supported) return { ok: false, reason: '仅支持 VEMIC / Made-in-China 的 HTTPS 商品 URL' }
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false })
    try {
      const loadedPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener)
          reject(new Error('URL 页面加载超时（30 秒）'))
        }, 30000)
        const listener = (tabId, info, changedTab) => {
          if (tabId === tab.id && info.status === 'complete') {
            clearTimeout(timer)
            chrome.tabs.onUpdated.removeListener(listener)
            resolve(changedTab)
          }
        }
        chrome.tabs.onUpdated.addListener(listener)
      })
      await chrome.tabs.update(tab.id, { url: url.href })
      await loadedPromise
      const loaded = await chrome.tabs.get(tab.id)
      let fieldsResponse = null
      let bestResponse = null
      let bestScore = -1
      let stableRounds = 0
      let lastMessageError = ''
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        try {
          fieldsResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_MIC_FIELDS' })
          if (fieldsResponse?.loginRequired) {
            bestResponse = fieldsResponse
            break
          }
          if (fieldsResponse?.fields) {
            const fields = fieldsResponse.fields
            const score =
              (fields.title ? 20 : 0) +
              (fields.category ? 10 : 0) +
              Math.min(40, (fields.specs?.length || 0) * 2) +
              Math.min(20, fields.formFields?.length || 0) +
              Math.min(10, Math.floor((fields.visibleText?.length || 0) / 1000))
            if (score > bestScore) {
              bestScore = score
              bestResponse = fieldsResponse
              stableRounds = 0
            } else stableRounds += 1
            if (bestScore >= 45 && stableRounds >= 3) break
          }
        } catch (error) {
          lastMessageError = error.message || String(error)
        }
      }
      fieldsResponse = bestResponse
      if (fieldsResponse?.loginRequired) {
        await chrome.tabs.update(tab.id, { active: true })
        return {
          ok: false,
          loginRequired: true,
          loginUrl: loaded.url,
          reason: '登录会话已失效，请在打开的页面完成登录后重新读取 URL',
          keepTab: true,
        }
      }
      if (!fieldsResponse?.fields)
        return { ok: false, reason: `页面已加载，但数据读取脚本未就绪${lastMessageError ? `：${lastMessageError}` : ''}` }
      return {
        ok: true,
        fields: fieldsResponse.fields,
        product: fieldsResponse.product || null,
        url: loaded.url,
      }
    } finally {
      const current = await chrome.tabs.get(tab.id).catch(() => null)
      if (current && !current.active) await chrome.tabs.remove(tab.id).catch(() => {})
    }
  }

  ns.bg.urlReader = { readUrlInAuthenticatedTab }
})(typeof globalThis !== 'undefined' ? globalThis : self)
