;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function normalizeCall(input, maxTokens) {
    if (Array.isArray(input)) {
      return {
        task: ASD.taskTypes ? ASD.taskTypes.PRODUCT_DIAGNOSIS : 'product_diagnosis',
        messages: input,
        maxTokens: maxTokens || 4200,
      }
    }
    const opts = input || {}
    return {
      task: opts.task || (ASD.taskTypes ? ASD.taskTypes.PRODUCT_DIAGNOSIS : 'product_diagnosis'),
      messages: opts.messages || [],
      provider: opts.provider,
      model: opts.model,
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      maxTokens: opts.maxTokens || maxTokens || 4200,
      capabilities: opts.capabilities || null,
      validationMode: opts.validationMode || opts.task,
      requestContext: opts.requestContext || null,
      temperature: opts.temperature,
    }
  }

  function requireTaskValidator() {
    if (!ASD.taskValidators || typeof ASD.taskValidators.validateByTask !== 'function') {
      const error = new Error('TASK_VALIDATOR_UNAVAILABLE')
      error.code = 'TASK_VALIDATOR_UNAVAILABLE'
      throw error
    }
  }

  function validateTask(task, raw) {
    requireTaskValidator()
    return ASD.taskValidators.validateByTask(task, raw)
  }

  function toLegacyData(normalized, fallbackModel) {
    return {
      usage: normalized.usage || null,
      model: normalized.model || fallbackModel,
      choices: [
        {
          finish_reason: normalized.finishReason || '',
          message: {
            content: normalized.content || '',
            reasoning_content: normalized.reasoningContent || '',
          },
        },
      ],
    }
  }

  function acceptParsed(task, raw, data, model, providerName, attempt, responseDebug) {
    const parsed = validateTask(task, raw)
    if (!parsed.ok) {
      const error = new Error('SCHEMA_ERROR:' + (parsed.errors || []).join(';'))
      error.schema = true
      error.code = 'SCHEMA_ERROR'
      throw error
    }
    let result = parsed.result
    if (task === 'product_diagnosis' && ASD.bg.payloadBuilder && ASD.bg.payloadBuilder.sanitizeModelEvidence) {
      result = ASD.bg.payloadBuilder.sanitizeModelEvidence(result)
    }
    const usage = ASD.bg.tokenAccounting
      ? ASD.bg.tokenAccounting.normalize(data.usage, { content: data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content })
      : data.usage || null
    return {
      result: result,
      usage: usage,
      model: data.model || model,
      provider: providerName,
      attempts: attempt + 1,
      schemaRepaired: parsed.repaired || [],
      finishReason: data && data.choices && data.choices[0] ? data.choices[0].finish_reason || '' : '',
      responseDebug: responseDebug || null,
      _healthRecorded: false,
    }
  }

  function openaiAdapter() {
    return ASD.bg.providers && ASD.bg.providers.openaiCompatible
  }

  function resolveRouted(opts, cfg) {
    if (ASD.bg.providerManager && typeof ASD.bg.providerManager.resolveProvider === 'function') {
      return ASD.bg.providerManager.resolveProvider(cfg, opts.provider || cfg.provider)
    }
    const routed =
      ASD.bg.modelRouter && typeof ASD.bg.modelRouter.resolve === 'function' ? ASD.bg.modelRouter.resolve(cfg) : null
    if (routed) return routed
    const isKimi = opts.provider === 'kimi' || opts.provider === 'moonshot' || cfg.provider === 'kimi'
    return {
      isKimi: isKimi,
      apiKey: isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey,
      providerName: isKimi ? 'Kimi' : 'DeepSeek',
      baseUrl: isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl,
      model: isKimi ? cfg.kimiModel : cfg.deepseekModel,
      isK3: isKimi && /kimi-k3/i.test(isKimi ? cfg.kimiModel : ''),
      adapter: openaiAdapter(),
    }
  }

  function classifyHttp(status, message) {
    const adapter = openaiAdapter()
    if (adapter && typeof adapter.classifyHttp === 'function') return adapter.classifyHttp(status, message)
    if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/i.test(message || '')) {
      return 'AUTH_ERROR'
    }
    if (status === 429 || /rate limit|too many requests/i.test(message || '')) return 'RATE_LIMIT_ERROR'
    if (status === 404 && /model/i.test(message || '')) return 'MODEL_NOT_FOUND'
    if (status >= 500) return 'PROVIDER_ERROR'
    return 'RESPONSE_ERROR'
  }

  function capabilitiesOf(routed, opts) {
    if (opts && opts.capabilities) return opts.capabilities
    if (routed && routed.capabilities) return routed.capabilities
    if (ASD.modelCapabilities && routed) {
      return ASD.modelCapabilities.resolve(
        routed.id,
        routed.model || (opts && opts.model),
        routed.config && routed.config.capabilitiesOverride,
        routed.config && routed.config.modelMetadata,
      )
    }
    return { text: true, vision: false, reasoning: false, structuredOutput: false, longContext: false }
  }

  function buildExtras(cfg, routed, caps) {
    const adapter = routed && routed.adapter
    if (adapter && typeof adapter.buildExtras === 'function') {
      return adapter.buildExtras({
        capabilities: caps,
        model: routed.model,
        thinking: (routed.config && routed.config.thinking) || (cfg && cfg.deepseekThinking) || '',
      })
    }
    return {}
  }

  function stripImageParts(messages) {
    return (messages || []).map(function (item) {
      if (!item || !Array.isArray(item.content)) return item
      const kept = item.content.filter(function (part) {
        return !part || part.type !== 'image_url'
      })
      if (!kept.length) return { role: item.role, content: '' }
      if (kept.length === 1 && kept[0].type === 'text') return { role: item.role, content: kept[0].text || '' }
      return { role: item.role, content: kept }
    })
  }

  function applyVisionGuard(messages, caps, task) {
    if (!messagesHaveImages(messages)) return messages
    if (caps && caps.vision === true) return messages
    if (task === 'vision_analysis') {
      const error = new Error('当前模型不支持该任务所需的视觉能力')
      error.code = 'UNSUPPORTED_CAPABILITY'
      throw error
    }
    return stripImageParts(messages)
  }

  function tryParseJson(text) {
    const cleaned = String(text || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    if (!cleaned) return null
    try {
      return JSON.parse(cleaned)
    } catch (error) {
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1))
        } catch (inner) {
          return null
        }
      }
      return null
    }
  }

  async function sendViaAdapterOrFetch(opts) {
    const adapter = opts.adapter || openaiAdapter()
    if (adapter && typeof adapter.sendRequest === 'function') {
      return adapter.sendRequest(opts)
    }
    const url = String(opts.baseUrl || '').replace(/\/$/, '') + '/chat/completions'
    const body = {
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
    }
    if (ASD.modelCapabilities && typeof ASD.modelCapabilities.applyTemperature === 'function') {
      ASD.modelCapabilities.applyTemperature(body, opts.capabilities, opts.temperature)
    }
    if (opts.responseFormat && opts.capabilities && opts.capabilities.structuredOutput === true) {
      body.response_format = opts.responseFormat
    }
    const extras = opts.extras || {}
    Object.keys(extras).forEach(function (key) {
      if (extras[key] != null) body[key] = extras[key]
    })
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + opts.apiKey },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
    const data = await response.json().catch(function () {
      return {}
    })
    if (!response.ok) {
      const msg = (data && data.error && data.error.message) || (opts.providerName || 'API') + ' 请求失败（HTTP ' + response.status + ')'
      const error = new Error(msg)
      error.code = classifyHttp(response.status, msg)
      throw error
    }
    if (adapter && typeof adapter.normalizeResponse === 'function') {
      return adapter.normalizeResponse(data, {
        httpStatus: response.status,
        provider: opts.providerName,
        model: opts.model,
      })
    }
    const message = (data && data.choices && data.choices[0] && data.choices[0].message) || {}
    return {
      content: typeof message.content === 'string' ? message.content.trim() : '',
      reasoningContent: typeof message.reasoning_content === 'string' ? message.reasoning_content : '',
      finishReason: (data && data.choices && data.choices[0] && data.choices[0].finish_reason) || '',
      usage: data.usage || null,
      model: data.model || opts.model,
    }
  }

  function messagesHaveImages(messages) {
    return (messages || []).some(function (item) {
      return (
        Array.isArray(item.content) &&
        item.content.some(function (part) {
          return part && part.type === 'image_url'
        })
      )
    })
  }

  function pickSelection(opts, cfg) {
    if (opts.route) return opts.route
    if (opts.provider) return null
    if (!ASD.bg.modelRouter || typeof ASD.bg.modelRouter.selectModel !== 'function') return null
    return ASD.bg.modelRouter.selectModel(
      opts.task,
      {
        settings: cfg,
        hasImages: (opts.requestContext && opts.requestContext.hasImages) || messagesHaveImages(opts.messages),
      },
      null,
    )
  }

  function recordHealth(routed, ok, startedAt, error) {
    if (!ASD.bg.modelHealth || !routed) return
    const latency = Date.now() - startedAt
    if (ok) ASD.bg.modelHealth.recordSuccess(routed.id || routed.providerName, routed.model, latency)
    else {
      ASD.bg.modelHealth.recordFailure(
        routed.id || routed.providerName,
        routed.model,
        latency,
        error && error.code,
        { retryAfterMs: error && error.retryAfterMs },
      )
    }
  }

  async function executeOnRouted(opts, cfg, routed) {
    requireTaskValidator()
    const caps = capabilitiesOf(routed, opts)
    if (routed) routed.capabilities = caps
    const apiKey = opts.apiKey || (routed && routed.apiKey)
    const providerName = opts.providerName || (routed && routed.providerName) || 'AI'
    if (!apiKey) {
      const error = new Error('请先在设置页填写 ' + providerName + ' API Key')
      error.code = 'CONFIG_ERROR'
      throw error
    }
    const baseUrl = opts.baseUrl || (routed && routed.baseUrl)
    const model = opts.model || (routed && routed.model)
    const isK3 = !!(caps.requestHints && caps.requestHints.longTimeout)
    const guardedMessages = applyVisionGuard(opts.messages, caps, opts.task)
    const isConnect = opts.task === 'connection_test'
    let lastReason = '空内容'
    let lastFinishReason = ''
    let lastCode = 'RESPONSE_ERROR'
    let lastDebug = null
    const deadline = Date.now() + (isConnect ? 25000 : isK3 ? 125000 : 55000)
    const maxAttempts = isConnect ? 2 : 3
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const remaining = deadline - Date.now()
      if (remaining < 3000) break
      const tokenBudget = isConnect ? (attempt === 0 ? 512 : 1024) : isK3 ? Math.max(opts.maxTokens, 6000) : opts.maxTokens
      const retryMessages =
        attempt === 0
          ? guardedMessages
          : guardedMessages.concat([
              {
                role: 'user',
                content:
                  lastFinishReason === 'length'
                    ? '上一次输出被截断。请重新输出完整 JSON，不要使用 Markdown 代码块。'
                    : '上一次响应' + lastReason + '。请立即重新输出完整、非空、可解析的 JSON 对象，不要使用 Markdown 代码块。',
              },
            ])
      if (!ASD.sanitize || typeof ASD.sanitize.sanitizePayload !== 'function') {
        throw new Error('SECURITY_SANITIZER_UNAVAILABLE')
      }
      const safeMessages = ASD.sanitize.sanitizePayload(retryMessages)
      const extras = buildExtras(cfg, routed, caps)
      const userTemperature =
        opts.temperature != null
          ? opts.temperature
          : routed && routed.config && routed.config.temperature != null
            ? routed.config.temperature
            : cfg && cfg.temperature
      const controller = new AbortController()
      const requestTimeout = setTimeout(
        function () {
          controller.abort()
        },
        Math.min(isConnect ? 12000 : isK3 ? (attempt === 0 ? 90000 : 30000) : attempt === 0 ? 35000 : 15000, remaining),
      )
      let normalized
      try {
        normalized = await sendViaAdapterOrFetch({
          apiKey: apiKey,
          baseUrl: baseUrl,
          model: model,
          messages: safeMessages,
          maxTokens: tokenBudget,
          temperature: userTemperature,
          responseFormat: caps.structuredOutput === true && !isK3 && attempt < 2 ? { type: 'json_object' } : null,
          extras: extras,
          signal: controller.signal,
          providerName: providerName,
          adapter: routed && routed.adapter,
          capabilities: caps,
        })
      } catch (error) {
        clearTimeout(requestTimeout)
        if (error.name === 'AbortError') {
          lastReason = '请求超时'
          lastCode = 'CONNECTION_ERROR'
          continue
        }
        error.code = error.code || 'CONNECTION_ERROR'
        if (error.responseDebug) lastDebug = error.responseDebug
        throw error
      }
      clearTimeout(requestTimeout)
      const data = toLegacyData(normalized, model)
      lastFinishReason = normalized.finishReason || ''
      lastDebug = normalized.debug || lastDebug
      if (lastFinishReason === 'length') lastCode = 'LENGTH_ERROR'
      const content = normalized.content || ''
      if (!content) {
        lastReason = lastFinishReason === 'length' ? '输出被截断' : '为空'
        lastCode = lastFinishReason === 'length' ? 'LENGTH_ERROR' : 'RESPONSE_ERROR'
        continue
      }
      const parsed = tryParseJson(content)
      if (!parsed) {
        lastReason = '不是有效 JSON'
        lastCode = 'RESPONSE_ERROR'
        continue
      }
      try {
        return acceptParsed(opts.task, parsed, data, model, providerName, attempt, normalized.debug)
      } catch (error) {
        if (error.schema) {
          lastReason = error.message
          lastCode = 'SCHEMA_ERROR'
          continue
        }
        lastReason = '不是有效 JSON'
        lastCode = 'RESPONSE_ERROR'
      }
    }
    const suffix =
      lastFinishReason === 'length'
        ? '（输出长度不足，已自动重试）'
        : lastFinishReason === 'stop'
          ? ''
          : lastFinishReason
            ? '（finish_reason: ' + lastFinishReason + '）'
            : ''
    const error = new Error(
      providerName +
        ' 未返回有效最终内容' +
        suffix +
        '。' +
        (isK3 ? 'K3 已等待最多 125 秒，请检查账号额度或改用 K2/非思考模型' : '请重试或切换模型'),
    )
    error.code = lastCode
    error.finishReason = lastFinishReason
    error.responseDebug = lastDebug
    throw error
  }

  async function callAI(input, maxTokens) {
    requireTaskValidator()
    const opts = normalizeCall(input, maxTokens)
    const cfg = await ASD.bg.settings.load()
    const selection = pickSelection(opts, cfg)
    if (selection && selection.ok === false) {
      const error = new Error((selection.reason || []).join('；') || '没有兼容模型')
      error.code = selection.code || 'NO_COMPATIBLE_MODEL'
      error.suggestAuto = !!selection.suggestAuto
      throw error
    }
    const primary =
      selection && selection.selected
        ? resolveRouted({ provider: selection.selected.provider, model: selection.selected.model }, cfg)
        : resolveRouted(opts, cfg)
    if (primary && selection && selection.selected && selection.selected.model) primary.model = selection.selected.model
    if (primary && selection && selection.selected && selection.selected.capabilities) {
      primary.capabilities = selection.selected.capabilities
    } else if (primary && !primary.capabilities) {
      primary.capabilities = capabilitiesOf(primary, opts)
    }
    if (opts.capabilities) primary.capabilities = opts.capabilities
    const startedAt = Date.now()
    try {
      const out = await executeOnRouted(opts, cfg, primary)
      out.route = selection || null
      recordHealth(primary, true, startedAt)
      out._healthRecorded = true
      return out
    } catch (error) {
      recordHealth(primary, false, startedAt, error)
      error._healthRecorded = true
      const backup = selection && selection.fallbacks && selection.fallbacks[0]
      if (
        backup &&
        (error.code === 'CONNECTION_ERROR' ||
          error.code === 'NETWORK_ERROR' ||
          error.code === 'RATE_LIMIT_ERROR' ||
          error.code === 'TIMEOUT' ||
          error.code === 'PROVIDER_ERROR' ||
          error.code === 'MODEL_NOT_FOUND')
      ) {
        const second = resolveRouted({ provider: backup.provider, model: backup.model }, cfg)
        if (backup.model) second.model = backup.model
        if (backup.capabilities) second.capabilities = backup.capabilities
        const retryAt = Date.now()
        try {
          const out = await executeOnRouted(opts, cfg, second)
          out.route = selection
          out.usedFallback = true
          recordHealth(second, true, retryAt)
          return out
        } catch (inner) {
          recordHealth(second, false, retryAt)
          throw inner
        }
      }
      throw error
    }
  }

  async function listAIModels(providerHint) {
    const cfg = await ASD.bg.settings.load()
    const routed = resolveRouted({ provider: providerHint }, cfg)
    const apiKey = routed.apiKey
    const baseUrl = routed.baseUrl
    const providerName = routed.providerName
    if (!apiKey) throw new Error('请先填写 ' + providerName + ' API Key')
    if (routed.supportsModelList === false) throw new Error(providerName + ' 未启用模型列表，请手填 Model ID')
    const adapter = routed.adapter || openaiAdapter()
    if (adapter && typeof adapter.listModels === 'function') {
      const listed = await adapter.listModels({ apiKey: apiKey, baseUrl: baseUrl, providerName: providerName })
      return { provider: providerName, models: listed.models }
    }
    const response = await fetch(String(baseUrl || '').replace(/\/$/, '') + '/models', {
      headers: { Authorization: 'Bearer ' + apiKey },
      cache: 'no-store',
    })
    const data = await response.json().catch(function () {
      return {}
    })
    if (!response.ok) throw new Error((data && data.error && data.error.message) || '获取模型失败（HTTP ' + response.status + ')')
    return {
      provider: providerName,
      models: (data.data || [])
        .map(function (item) {
          return item.id
        })
        .filter(Boolean)
        .sort(),
    }
  }

  ns.bg.aiClient = { callAI: callAI, listAIModels: listAIModels, normalizeCall: normalizeCall }
})(typeof globalThis !== 'undefined' ? globalThis : self)
