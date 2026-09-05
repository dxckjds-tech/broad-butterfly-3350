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
    }
  }

  function validateTask(task, raw) {
    if (ASD.taskValidators && typeof ASD.taskValidators.validateByTask === 'function') {
      return ASD.taskValidators.validateByTask(task, raw)
    }
    if (task === 'product_diagnosis' && ASD.schema) return ASD.schema.normalizeAndValidate(raw)
    return { ok: true, result: raw, repaired: [] }
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

  function acceptParsed(task, raw, data, model, providerName, attempt) {
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
    return {
      result: result,
      usage: data.usage || null,
      model: data.model || model,
      provider: providerName,
      attempts: attempt + 1,
      schemaRepaired: parsed.repaired || [],
      finishReason: data && data.choices && data.choices[0] ? data.choices[0].finish_reason || '' : '',
    }
  }

  function openaiAdapter() {
    return ASD.bg.providers && ASD.bg.providers.openaiCompatible
  }

  function classifyHttp(status, message) {
    const adapter = openaiAdapter()
    if (adapter && typeof adapter.classifyHttp === 'function') return adapter.classifyHttp(status, message)
    if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/i.test(message || '')) {
      return 'AUTH_ERROR'
    }
    if (status === 429 || status >= 500) return 'CONNECTION_ERROR'
    return 'RESPONSE_ERROR'
  }

  function buildExtras(cfg, isKimi, model, isK3) {
    if (!isKimi) return { thinking: { type: cfg.deepseekThinking || 'disabled' } }
    if (/kimi-k2\.5/i.test(model)) return { thinking: { type: 'disabled' } }
    if (isK3) return { reasoning_effort: 'low' }
    return {}
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
    const adapter = openaiAdapter()
    if (adapter && typeof adapter.sendRequest === 'function') {
      return adapter.sendRequest(opts)
    }
    const url = String(opts.baseUrl || '').replace(/\/$/, '') + '/chat/completions'
    const body = {
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature != null ? opts.temperature : 0.2,
    }
    if (opts.responseFormat) body.response_format = opts.responseFormat
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
    const message = (data && data.choices && data.choices[0] && data.choices[0].message) || {}
    return {
      content: typeof message.content === 'string' ? message.content.trim() : '',
      reasoningContent: typeof message.reasoning_content === 'string' ? message.reasoning_content : '',
      finishReason: (data && data.choices && data.choices[0] && data.choices[0].finish_reason) || '',
      usage: data.usage || null,
      model: data.model || opts.model,
      raw: data,
    }
  }

  async function callAI(input, maxTokens) {
    const opts = normalizeCall(input, maxTokens)
    const cfg = await ASD.bg.settings.load()
    const routed =
      ASD.bg.modelRouter && typeof ASD.bg.modelRouter.resolve === 'function' ? ASD.bg.modelRouter.resolve(cfg) : null
    const isKimi = opts.provider ? opts.provider === 'kimi' || opts.provider === 'moonshot' : !!(routed && routed.isKimi)
    const apiKey = opts.apiKey || (routed && routed.apiKey) || (isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey)
    const providerName = opts.providerName || (routed && routed.providerName) || (isKimi ? 'Kimi' : 'DeepSeek')
    if (!apiKey) {
      const error = new Error('请先在设置页填写 ' + providerName + ' API Key')
      error.code = 'CONFIG_ERROR'
      throw error
    }
    const baseUrl = opts.baseUrl || (routed && routed.baseUrl) || (isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl)
    const model = opts.model || (routed && routed.model) || (isKimi ? cfg.kimiModel : cfg.deepseekModel)
    const isK3 = isKimi && /kimi-k3/i.test(model)
    const isConnect = opts.task === 'connection_test'
    let lastReason = '空内容'
    let lastFinishReason = ''
    let lastCode = 'RESPONSE_ERROR'
    const deadline = Date.now() + (isConnect ? 25000 : isK3 ? 125000 : 55000)
    const maxAttempts = isConnect ? 2 : 3
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const remaining = deadline - Date.now()
      if (remaining < 3000) break
      const tokenBudget = isConnect ? (attempt === 0 ? 512 : 1024) : isK3 ? Math.max(opts.maxTokens, 6000) : opts.maxTokens
      const retryMessages =
        attempt === 0
          ? opts.messages
          : opts.messages.concat([
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
      const extras = buildExtras(cfg, isKimi, model, isK3)
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
          temperature: isKimi ? 1 : 0.2,
          responseFormat: !isK3 && attempt < 2 ? { type: 'json_object' } : null,
          extras: extras,
          signal: controller.signal,
          providerName: providerName,
        })
      } catch (error) {
        clearTimeout(requestTimeout)
        if (error.name === 'AbortError') {
          lastReason = '请求超时'
          lastCode = 'CONNECTION_ERROR'
          continue
        }
        error.code = error.code || 'CONNECTION_ERROR'
        throw error
      }
      clearTimeout(requestTimeout)
      const data = toLegacyData(normalized, model)
      lastFinishReason = normalized.finishReason || ''
      if (lastFinishReason === 'length') lastCode = 'LENGTH_ERROR'
      const content = normalized.content || ''
      if (!content) {
        const reasoning = String(normalized.reasoningContent || '').trim()
        if (reasoning) {
          const parsed = tryParseJson(reasoning)
          if (parsed) {
            try {
              return acceptParsed(opts.task, parsed, data, model, providerName, attempt)
            } catch (error) {
              lastReason = error.schema ? error.message : lastReason
              lastCode = error.schema ? 'SCHEMA_ERROR' : lastCode
            }
          }
        }
        lastReason = lastFinishReason === 'length' ? '输出被截断' : '为空'
        continue
      }
      const parsed = tryParseJson(content)
      if (!parsed) {
        lastReason = '不是有效 JSON'
        lastCode = 'RESPONSE_ERROR'
        continue
      }
      try {
        return acceptParsed(opts.task, parsed, data, model, providerName, attempt)
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
    throw error
  }

  async function listAIModels(providerHint) {
    const cfg = await ASD.bg.settings.load()
    const routed = ASD.bg.modelRouter && ASD.bg.modelRouter.resolve ? ASD.bg.modelRouter.resolve(cfg) : null
    const isKimi = providerHint
      ? providerHint === 'kimi' || providerHint === 'moonshot'
      : routed
        ? routed.isKimi
        : cfg.provider === 'kimi'
    const apiKey = routed && !providerHint ? routed.apiKey : isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey
    const baseUrl = routed && !providerHint ? routed.baseUrl : isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl
    const providerName = routed && !providerHint ? routed.providerName : isKimi ? 'Kimi' : 'DeepSeek'
    if (!apiKey) throw new Error('请先填写 ' + providerName + ' API Key')
    const adapter = openaiAdapter()
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
