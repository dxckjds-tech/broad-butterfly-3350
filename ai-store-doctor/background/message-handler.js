;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function classify(error) {
    if (error && error.code) {
      if (
        error.code === 'AUTH_ERROR' ||
        error.code === 'CONNECTION_ERROR' ||
        error.code === 'LENGTH_ERROR' ||
        error.code === 'RESPONSE_ERROR' ||
        error.code === 'SCHEMA_ERROR' ||
        error.code === 'CONFIG_ERROR' ||
        error.code === 'NO_COMPATIBLE_MODEL' ||
        error.code === 'TASK_VALIDATOR_UNAVAILABLE' ||
        error.code === 'UNSUPPORTED_CAPABILITY' ||
        error.code === 'ORCHESTRATION_BUDGET_EXCEEDED' ||
        error.code === 'BUDGET_EXCEEDED' ||
        error.code === 'COST_BUDGET_EXCEEDED' ||
        error.code === 'TOKEN_BUDGET_EXCEEDED' ||
        error.code === 'TOKEN_INPUT_BUDGET_EXCEEDED' ||
        error.code === 'TOKEN_OUTPUT_BUDGET_EXCEEDED' ||
        error.code === 'NETWORK_ERROR' ||
        error.code === 'RATE_LIMIT_ERROR' ||
        error.code === 'MODEL_NOT_FOUND' ||
        error.code === 'TIMEOUT' ||
        error.code === 'PROVIDER_ERROR' ||
        error.code === 'VALIDATION_ERROR' ||
        error.code === 'EVIDENCE_CONFLICT' ||
        error.code === 'SECURITY_SANITIZER_UNAVAILABLE' ||
        error.code === 'PAYLOAD_BUDGET_EXCEEDED' ||
        error.code === 'API_KEY_MISSING' ||
        error.code === 'COLLECTION_INCOMPLETE'
      ) {
        return error.code
      }
    }
    const msg = (error && error.message) || String(error || '')
    if (/API Key|设置页|HTTPS|CONFIG_ERROR/.test(msg)) return 'CONFIG_ERROR'
    if (/AUTH_ERROR|401|invalid api key|unauthorized/i.test(msg)) return 'AUTH_ERROR'
    if (/API_KEY_MISSING/.test(msg)) return 'API_KEY_MISSING'
    if (/CONNECTION_ERROR|Failed to fetch|超时|network/i.test(msg)) return 'CONNECTION_ERROR'
    if (/LENGTH_ERROR|输出被截断|输出长度不足/.test(msg)) return 'LENGTH_ERROR'
    if (/PAYLOAD_BUDGET_EXCEEDED|商品信息过长，已自动压缩/.test(msg)) return 'PAYLOAD_BUDGET_EXCEEDED'
    if (/COLLECTION_INCOMPLETE/.test(msg)) return 'COLLECTION_INCOMPLETE'
    if (/SCHEMA_ERROR|PAYLOAD_|RESPONSE_ERROR/.test(msg)) return 'SCHEMA_ERROR'
    if (/商品 URL|NO_|无法取得|CONTENT_SCRIPT/.test(msg)) return 'FIELD_ERROR'
    return 'AI_ERROR'
  }

  function fail(reason, code) {
    return { ok: false, reason: reason, code: code || 'FIELD_ERROR' }
  }

  async function handle(message, sender) {
    if (message?.type === 'REQUEST_URL_FIELDS') {
      return await ASD.bg.urlReader.readUrlInAuthenticatedTab(message.url, {
        forceResample: !!(message && message.forceResample),
      })
    }
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
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_MIC_FIELDS',
          forceResample: !!(message && message.forceResample),
        })
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
      try {
        const out = await ASD.bg.aiClient.callAI({
          task: 'connection_test',
          provider: message.provider || undefined,
          messages: [
            { role: 'system', content: '你正在执行 API 连通性测试。只输出 JSON，不要解释。' },
            { role: 'user', content: '严格输出：\n{"ok":true,"message":"连接成功"}' },
          ],
          maxTokens: 512,
        })
        if (out && ASD.bg.modelHealth && typeof ASD.bg.modelHealth.clearAttention === 'function') {
          ASD.bg.modelHealth.clearAttention(message.provider || (out.route && out.route.selected && out.route.selected.provider))
        }
        return { ok: out.result && out.result.ok === true, ...out }
      } catch (error) {
        return { ok: false, reason: error.message || '连接失败', code: classify(error) }
      }
    }
    if (message?.type === 'LIST_AI_MODELS') {
      return { ok: true, ...(await ASD.bg.aiClient.listAIModels(message.provider)) }
    }
    if (message?.type === 'TRANSLATE_TEXT') {
      const sourceText = String(message.text || '')
        .trim()
        .slice(0, 12000)
      if (!sourceText) return { ok: false, reason: '没有可翻译的英文内容' }
      const out = await ASD.bg.aiClient.callAI({
        task: 'translation',
        messages: [
          {
            role: 'system',
            content:
              '你是专业跨境电商翻译。将用户提供的英文忠实翻译为简体中文，保留型号、数字、单位、品牌和段落结构。只输出 JSON：{"translation":"中文译文"}',
          },
          { role: 'user', content: sourceText },
        ],
        maxTokens: 1800,
      })
      return { ok: true, translation: out.result?.translation || '', provider: out.provider, model: out.model }
    }
    if (message?.type === 'ANALYZE_PRODUCT') {
      const source = message.fields || {}
      const cfg = await ASD.bg.settings.load()
      const visionSource = (message.product && message.product.images) || source.images || []
      const hasImages = visionSource.length > 0
      if (ASD.bg.orchestrator && typeof ASD.bg.orchestrator.runProductDiagnosis === 'function') {
        const plan = ASD.bg.orchestrationPlanner
          ? ASD.bg.orchestrationPlanner.build({ settings: cfg, hasImages: hasImages })
          : { ok: true, mode: 'single', stages: [{ model: cfg.deepseekModel || '' }] }
        if (!plan.ok) {
          return {
            ok: false,
            reason: (plan.reason || []).join('；') || '没有兼容模型',
            code: plan.code || 'NO_COMPATIBLE_MODEL',
          }
        }
        const key = ASD.bg.requests.fingerprint({
          url: source.url,
          title: source.title,
          name: message.product && message.product.product && message.product.product.name,
          model: (plan.stages || []).map(function (item) { return item.model }).join('+'),
          promptVersion: ASD.constants.PROMPT_VERSION,
        })
        try {
          return await ASD.bg.requests.run(key, async function () {
            const out = await ASD.bg.orchestrator.runProductDiagnosis({
              productBundle: message.product,
              fields: source,
              images: visionSource,
              settings: cfg,
              requestContext: { hasImages: hasImages },
            })
            out.requestId = message.requestId || null
            out.fieldsVersion = message.fieldsVersion || 0
            out.collaboration = ASD.bg.orchestrationPlanner.formatCollaboration(out.plan || plan)
            return { ok: true, ...out }
          })
        } catch (error) {
          return {
            ok: false,
            reason: error.message || 'AI 分析失败',
            code: classify(error),
            requestId: message.requestId || null,
            fieldsVersion: message.fieldsVersion || 0,
            payloadDebug: error.payloadDebug || null,
          }
        }
      }
      const route = ASD.bg.modelRouter && ASD.bg.modelRouter.selectModel
        ? ASD.bg.modelRouter.selectModel(
            'product_diagnosis',
            { hasImages: hasImages, settings: cfg },
            null,
          )
        : { ok: true, selected: { provider: cfg.provider, model: cfg.provider === 'kimi' ? cfg.kimiModel : cfg.deepseekModel, capabilities: {} } }
      if (!route.ok || !route.selected) {
        return {
          ok: false,
          reason: (route.reason || []).join('；') || '没有兼容模型',
          code: route.code || 'NO_COMPATIBLE_MODEL',
          suggestAuto: !!route.suggestAuto,
        }
      }
      const activeModel = route.selected.model
      const key = ASD.bg.requests.fingerprint({
        url: source.url,
        title: source.title,
        name: message.product && message.product.product && message.product.product.name,
        model: activeModel,
        promptVersion: ASD.constants.PROMPT_VERSION,
      })
      try {
        return await ASD.bg.requests.run(key, async function () {
          const built = ASD.bg.payloadBuilder.buildAnalyzePayload(message.product, source, { images: visionSource })
          const nonce = ASD.bg.payloadBuilder.randomNonce()
          const wrapped = ASD.bg.payloadBuilder.wrapUntrusted(built.text, nonce)
          const visionCapable = !!(route.selected.capabilities && route.selected.capabilities.vision)
          const compactImages = built.images && built.images.length ? built.images : visionSource
          const visionPack = visionCapable
            ? await ASD.bg.imageFetcher.fetchVisionImages(compactImages, {
                limit: compactImages.length,
              })
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
          const out = await ASD.bg.aiClient.callAI({
            task: 'product_diagnosis',
            provider: route.selected.provider,
            model: route.selected.model,
            route: route,
            requestContext: { hasImages: hasImages },
            messages: [
              { role: 'system', content: ASD.bg.promptBuilder.SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
          })
          out.route = route
          out.visionUsed = imageBlocks.length > 0
          out.payloadMode = built.mode
          out.payloadTruncated = built.truncated
          out.payloadProfile = built.profile
          out.payloadDebug = built.payloadDebug || null
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
          payloadDebug: error.payloadDebug || null,
        }
      }
    }
    return { ok: false, reason: 'UNKNOWN_MESSAGE' }
  }

  ns.bg.messageHandler = { handle, classify }
})(typeof globalThis !== 'undefined' ? globalThis : self)
