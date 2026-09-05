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

  function classifyHttp(status, message) {
    if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/i.test(message || '')) {
      return 'AUTH_ERROR'
    }
    if (status === 429) return 'CONNECTION_ERROR'
    if (status >= 500) return 'CONNECTION_ERROR'
    return 'RESPONSE_ERROR'
  }

  async function callAI(input, maxTokens) {
    const opts = normalizeCall(input, maxTokens)
    const cfg = await ASD.bg.settings.load()
    const routed =
      ASD.bg.modelRouter && typeof ASD.bg.modelRouter.resolve === 'function' ? ASD.bg.modelRouter.resolve(cfg) : null
    const isKimi = opts.provider ? opts.provider === 'kimi' || opts.provider === 'moonshot' : !!(routed && routed.isKimi)
    const apiKey = opts.apiKey || (routed && routed.apiKey) || (isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey)
    const providerName =
      opts.providerName || (routed && routed.providerName) || (isKimi ? 'Kimi' : 'DeepSeek')
    if (!apiKey) {
      const error = new Error('请先在设置页填写 ' + providerName + ' API Key')
      error.code = 'CONFIG_ERROR'
      throw error
    }
    const baseUrl = opts.baseUrl || (routed && routed.baseUrl) || (isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl)
    const model = opts.model || (routed && routed.model) || (isKimi ? cfg.kimiModel : cfg.deepseekModel)
    const isK3 = isKimi && /kimi-k3/i.test(model)
    const url = baseUrl.replace(/\/$/, '') + '/chat/completions'
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
      const body = {
        model: model,
        messages: safeMessages,
        max_tokens: tokenBudget,
        temperature: isKimi ? 1 : 0.2,
      }
      if (!isK3 && attempt < 2) body.response_format = { type: 'json_object' }
      if (!isKimi) body.thinking = { type: cfg.deepseekThinking }
      else if (/kimi-k2\.5/i.test(model)) body.thinking = { type: 'disabled' }
      else if (isK3) body.reasoning_effort = 'low'
      const controller = new AbortController()
      const requestTimeout = setTimeout(
        function () {
          controller.abort()
        },
        Math.min(isConnect ? 12000 : isK3 ? (attempt === 0 ? 90000 : 30000) : attempt === 0 ? 35000 : 15000, remaining),
      )
      let response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
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
      const data = await response.json().catch(function () {
        return {}
      })
      if (!response.ok) {
        const msg = (data && data.error && data.error.message) || providerName + ' API 请求失败（HTTP ' + response.status + ')'
        const code = classifyHttp(response.status, msg)
        const error = new Error(msg)
        error.code = code
        throw error
      }
      const message = (data && data.choices && data.choices[0] && data.choices[0].message) || {}
      lastFinishReason = (data && data.choices && data.choices[0] && data.choices[0].finish_reason) || ''
      if (lastFinishReason === 'length') lastCode = 'LENGTH_ERROR'
      const rawContent = message.content
      const content = (
        typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent
                .map(function (part) {
                  return (part && (part.text || part.content)) || ''
                })
                .join('')
            : ''
      ).trim()
      if (!content) {
        const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : ''
        if (reasoning) {
          const start = reasoning.indexOf('{')
          const end = reasoning.lastIndexOf('}')
          if (start >= 0 && end > start) {
            try {
              return acceptParsed(opts.task, JSON.parse(reasoning.slice(start, end + 1)), data, model, providerName, attempt)
            } catch (error) {
              lastReason = error.schema ? error.message : lastReason
              lastCode = error.schema ? 'SCHEMA_ERROR' : lastCode
            }
          }
        }
        lastReason = lastFinishReason === 'length' ? '输出被截断' : '为空'
        continue
      }
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      try {
        return acceptParsed(opts.task, JSON.parse(cleaned), data, model, providerName, attempt)
      } catch (error) {
        if (error.schema) {
          lastReason = error.message
          lastCode = 'SCHEMA_ERROR'
          continue
        }
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        if (start >= 0 && end > start) {
          try {
            return acceptParsed(opts.task, JSON.parse(cleaned.slice(start, end + 1)), data, model, providerName, attempt)
          } catch (inner) {
            lastReason = inner.schema ? inner.message : '不是有效 JSON'
            lastCode = inner.schema ? 'SCHEMA_ERROR' : 'RESPONSE_ERROR'
            continue
          }
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

  async function listAIModels() {
    const cfg = await ASD.bg.settings.load()
    const routed = ASD.bg.modelRouter && ASD.bg.modelRouter.resolve ? ASD.bg.modelRouter.resolve(cfg) : null
    const isKimi = routed ? routed.isKimi : cfg.provider === 'kimi'
    const apiKey = routed ? routed.apiKey : isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey
    const baseUrl = routed ? routed.baseUrl : isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl
    const providerName = routed ? routed.providerName : isKimi ? 'Kimi' : 'DeepSeek'
    if (!apiKey) throw new Error('请先填写 ' + providerName + ' API Key')
    const response = await fetch(baseUrl.replace(/\/$/, '') + '/models', {
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
