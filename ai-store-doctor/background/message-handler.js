;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function classify(error) {
    const msg = (error && error.message) || String(error || '')
    if (/API Key|设置页|HTTPS/.test(msg)) return 'CONFIG_ERROR'
    if (/SCHEMA_ERROR|PAYLOAD_/.test(msg)) return 'SCHEMA_ERROR'
    if (/商品 URL|NO_|无法取得|CONTENT_SCRIPT/.test(msg)) return 'FIELD_ERROR'
    return 'AI_ERROR'
  }

  function fail(reason, code) {
    return { ok: false, reason: reason, code: code || 'FIELD_ERROR' }
  }

  async function handle(message, sender) {
    if (message?.type === 'REQUEST_URL_FIELDS') return await ASD.bg.urlReader.readUrlInAuthenticatedTab(message.url)
    if (message?.type === 'GET_ACTIVE_URL') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return tab?.url ? { ok: true, url: tab.url } : { ok: false, reason: '无法取得当前页面 URL' }
    }
    if (message?.type === 'REQUEST_MIC_FIELDS') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return fail('NO_ACTIVE_TAB')
      let hostname = ''
      try {
        hostname = new URL(tab.url).hostname
      } catch (e) {
        return fail('无法取得当前页面 URL')
      }
      if (!ASD.constants.isSupportedHost(hostname)) return fail('当前页不是 VEMIC / Made-in-China')
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_MIC_FIELDS' })
        if (response?.loginRequired) return fail(response.reason || '需要登录')
        if (response?.fields)
          return { ok: true, fields: response.fields, product: response.product || null, url: tab.url }
        return fail('NO_FIELDS')
      } catch (e) {
        return fail('CONTENT_SCRIPT_UNAVAILABLE')
      }
    }
    if (message?.type === 'OPEN_OPTIONS') {
      await chrome.runtime.openOptionsPage()
      return { ok: true }
    }
    if (message?.type === 'TEST_AI') {
      const out = await ASD.bg.aiClient.callAI(
        [
          { role: 'system', content: '请只输出 JSON。' },
          { role: 'user', content: '输出 {"ok":true,"message":"连接成功"}' },
        ],
        100,
      )
      return { ok: out.result?.ok === true, ...out }
    }
    if (message?.type === 'LIST_AI_MODELS') return { ok: true, ...(await ASD.bg.aiClient.listAIModels()) }
    if (message?.type === 'TRANSLATE_TEXT') {
      const sourceText = String(message.text || '')
        .trim()
        .slice(0, 12000)
      if (!sourceText) return { ok: false, reason: '没有可翻译的英文内容' }
      const out = await ASD.bg.aiClient.callAI(
        [
          {
            role: 'system',
            content:
              '你是专业跨境电商翻译。将用户提供的英文忠实翻译为简体中文，保留型号、数字、单位、品牌和段落结构。只输出 JSON：{"translation":"中文译文"}',
          },
          { role: 'user', content: sourceText },
        ],
        1800,
      )
      return { ok: true, translation: out.result?.translation || '', provider: out.provider, model: out.model }
    }
    if (message?.type === 'ANALYZE_PRODUCT') {
      const source = message.fields || {}
      const cfg = await ASD.bg.settings.load()
      const activeModel = cfg.provider === 'kimi' ? cfg.kimiModel : cfg.deepseekModel
      const key = ASD.bg.requests.fingerprint({
        url: source.url,
        title: source.title,
        name: message.product && message.product.product && message.product.product.name,
        model: activeModel,
        promptVersion: ASD.constants.PROMPT_VERSION,
      })
      try {
        return await ASD.bg.requests.run(key, async function () {
          const built = ASD.bg.payloadBuilder.buildAnalyzePayload(message.product, source)
          const nonce = ASD.bg.payloadBuilder.randomNonce()
          const wrapped = ASD.bg.payloadBuilder.wrapUntrusted(built.text, nonce)
          const visionCapable = /kimi-k3|kimi-k2\.5|vision/i.test(activeModel)
          const visionSource = (message.product && message.product.images) || source.images || []
          const visionPack = visionCapable
            ? await ASD.bg.imageFetcher.fetchVisionImages(visionSource)
            : { urls: [], picked: [], ranked: [] }
          const visionUrls = visionPack.urls
          const pickedSources = new Set(
            (visionPack.picked || []).map(function (item) {
              return item.originalSrc
            }),
          )
          const imageBlocks = visionUrls.map((url) => ({ type: 'image_url', image_url: { url } }))
          const intro = imageBlocks.length
            ? '请结合真实图片像素与下列不可信页面数据完成诊断并输出 JSON。禁止根据图片文件名或 URL 猜测图片内容。'
            : '请根据下列不可信页面数据完成诊断并输出 JSON。当前模型未启用视觉能力，不得把图片 URL 当作图片证据。'
          const userText = `${intro}\n${wrapped}`
          const userContent = imageBlocks.length ? [{ type: 'text', text: userText }, ...imageBlocks] : userText
          const out = await ASD.bg.aiClient.callAI([
            { role: 'system', content: ASD.bg.promptBuilder.SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ])
          out.visionUsed = imageBlocks.length > 0
          out.payloadMode = built.mode
          out.payloadTruncated = built.truncated
          out.requestId = message.requestId || null
          out.fieldsVersion = message.fieldsVersion || 0
          out.imageRank = (visionPack.ranked || []).map(function (img) {
            return {
              src: ASD.imageScore ? ASD.imageScore.redactSrc(img.src) : img.src,
              score: img.score || 0,
              reasons: img.reasons || [],
              selected: pickedSources.has(img.src),
            }
          })
          return { ok: true, ...out }
        })
      } catch (error) {
        return {
          ok: false,
          reason: error.message || 'AI 分析失败',
          code: classify(error),
          requestId: message.requestId || null,
          fieldsVersion: message.fieldsVersion || 0,
        }
      }
    }
    return { ok: false, reason: 'UNKNOWN_MESSAGE' }
  }

  ns.bg.messageHandler = { handle, classify }
})(typeof globalThis !== 'undefined' ? globalThis : self)
