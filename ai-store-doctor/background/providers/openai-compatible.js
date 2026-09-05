;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  ns.bg.providers = ns.bg.providers || {}

  function classifyHttp(status, message) {
    if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/i.test(message || '')) {
      return 'AUTH_ERROR'
    }
    if (status === 429 || /rate limit|too many requests/i.test(message || '')) return 'RATE_LIMIT_ERROR'
    if (status === 404 && /model/i.test(message || '')) return 'MODEL_NOT_FOUND'
    if (status >= 500) return 'PROVIDER_ERROR'
    return 'RESPONSE_ERROR'
  }

  function contentTypeOf(rawContent) {
    if (typeof rawContent === 'string') return 'string'
    if (Array.isArray(rawContent)) return 'array'
    if (rawContent == null) return 'empty'
    return typeof rawContent
  }

  function extractText(rawContent) {
    if (typeof rawContent === 'string') return rawContent.trim()
    if (!Array.isArray(rawContent)) return ''
    return rawContent
      .map(function (part) {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const partType = String(part.type || '').toLowerCase()
        if (partType === 'reasoning' || partType === 'thinking' || partType === 'thought') return ''
        if (partType === 'text' || partType === 'output_text') return part.text || part.content || ''
        return part.text || (typeof part.content === 'string' ? part.content : '')
      })
      .join('')
      .trim()
  }

  function extractFinalContent(data, message, choice) {
    const fromMessage = extractText(message && message.content)
    if (fromMessage) {
      return { content: fromMessage, contentType: contentTypeOf(message.content), source: 'message.content' }
    }
    if (message && typeof message.output_text === 'string' && message.output_text.trim()) {
      return { content: message.output_text.trim(), contentType: 'output_text', source: 'message.output_text' }
    }
    if (choice && typeof choice.text === 'string' && choice.text.trim()) {
      return { content: choice.text.trim(), contentType: 'choice.text', source: 'choice.text' }
    }
    if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
      return { content: data.output_text.trim(), contentType: 'output_text', source: 'output_text' }
    }
    return { content: '', contentType: contentTypeOf(message && message.content), source: 'message.content' }
  }

  function objectKeys(value) {
    if (!value || typeof value !== 'object') return []
    return Object.keys(value).slice(0, 24)
  }

  function responseDebug(data, extras, extracted) {
    const extra = extras || {}
    const choice = data && data.choices && data.choices[0]
    const message = (choice && choice.message) || {}
    return {
      provider: extra.provider || extra.providerName || '',
      model: (data && data.model) || extra.model || '',
      httpStatus: extra.httpStatus != null ? extra.httpStatus : 200,
      finishReason: (choice && choice.finish_reason) || '',
      choicesCount: data && Array.isArray(data.choices) ? data.choices.length : 0,
      contentType: extracted && extracted.contentType ? extracted.contentType : contentTypeOf(message.content),
      contentLength: extracted && extracted.content ? extracted.content.length : 0,
      hasReasoningContent: !!(message.reasoning_content || message.reasoning || message.thinking),
      topLevelKeys: objectKeys(data),
      messageKeys: objectKeys(message),
    }
  }

  function normalizeResponse(data, extras) {
    const choice = data && data.choices && data.choices[0]
    const message = (choice && choice.message) || {}
    const extracted = extractFinalContent(data, message, choice)
    const reasoning =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content
        : typeof message.reasoning === 'string'
          ? message.reasoning
          : ''
    return {
      content: extracted.content,
      reasoningContent: reasoning,
      finishReason: (choice && choice.finish_reason) || '',
      usage: (data && data.usage) || null,
      model: (data && data.model) || (extras && extras.model) || '',
      debug: responseDebug(data, extras, extracted),
    }
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

  function resolveTemperature(opts) {
    if (ASD.modelCapabilities && typeof ASD.modelCapabilities.resolveRequestTemperature === 'function') {
      return ASD.modelCapabilities.resolveRequestTemperature(opts && opts.capabilities, opts && opts.temperature)
    }
    return { send: false }
  }

  function buildExtras(opts) {
    const caps = opts.capabilities || {}
    const extras = {}
    if (!caps.reasoning) return extras
    const hints = caps.requestHints || {}
    if (hints.thinking) extras.thinking = hints.thinking
    if (hints.reasoning_effort) extras.reasoning_effort = hints.reasoning_effort
    if (hints.thinkingFromConfig && opts.thinking) extras.thinking = { type: opts.thinking }
    return extras
  }

  function buildRequest(opts) {
    const caps = opts.capabilities || {}
    const body = {
      model: opts.model,
      messages: caps.vision === true ? opts.messages : stripImageParts(opts.messages),
      max_tokens: opts.maxTokens,
    }
    const temp = resolveTemperature(opts)
    if (temp.send) body.temperature = temp.value
    if (opts.responseFormat && caps.structuredOutput === true) body.response_format = opts.responseFormat
    const extras = opts.extras || buildExtras(opts)
    Object.keys(extras).forEach(function (key) {
      if (extras[key] != null) body[key] = extras[key]
    })
    return body
  }

  function parseError(status, data, fallbackName) {
    const msg =
      (data && data.error && data.error.message) ||
      (fallbackName || 'API') + ' 请求失败（HTTP ' + status + ')'
    const error = new Error(msg)
    error.status = status
    error.code = classifyHttp(status, msg)
    return error
  }

  async function sendRequest(opts) {
    const url = String(opts.baseUrl || '').replace(/\/$/, '') + '/chat/completions'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + opts.apiKey,
      },
      body: JSON.stringify(buildRequest(opts)),
      signal: opts.signal,
    })
    const data = await response.json().catch(function () {
      return {}
    })
    if (!response.ok) {
      const error = parseError(response.status, data, opts.providerName)
      const retryAfter = response.headers && response.headers.get && response.headers.get('Retry-After')
      if (retryAfter) {
        const sec = Number(retryAfter)
        error.retryAfterMs = Number.isFinite(sec) ? sec * 1000 : 15000
      }
      error.responseDebug = responseDebug(data, {
        httpStatus: response.status,
        provider: opts.providerName,
        model: opts.model,
      })
      throw error
    }
    return normalizeResponse(data, {
      httpStatus: response.status,
      provider: opts.providerName,
      model: opts.model,
    })
  }

  async function testConnection(opts) {
    return sendRequest(
      Object.assign({}, opts, {
        maxTokens: opts.maxTokens || 512,
        responseFormat: opts.responseFormat || { type: 'json_object' },
      }),
    )
  }

  async function listModels(opts) {
    const url = String(opts.baseUrl || '').replace(/\/$/, '') + '/models'
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + opts.apiKey },
      cache: 'no-store',
      signal: opts.signal,
    })
    const data = await response.json().catch(function () {
      return {}
    })
    if (!response.ok) throw parseError(response.status, data, opts.providerName)
    return {
      models: (data.data || [])
        .map(function (item) {
          return item && item.id
        })
        .filter(Boolean)
        .sort(),
      raw: data,
    }
  }

  ns.bg.providers.openaiCompatible = {
    sendRequest: sendRequest,
    testConnection: testConnection,
    listModels: listModels,
    normalizeResponse: normalizeResponse,
    extractText: extractText,
    extractFinalContent: extractFinalContent,
    responseDebug: responseDebug,
    buildRequest: buildRequest,
    buildExtras: buildExtras,
    stripImageParts: stripImageParts,
    parseError: parseError,
    classifyHttp: classifyHttp,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
