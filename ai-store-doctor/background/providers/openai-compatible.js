;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  ns.bg.providers = ns.bg.providers || {}

  function shared() {
    return ASD.responseNormalize
  }

  function classifyHttp(status, message) {
    if (shared() && typeof shared().classifyHttp === 'function') return shared().classifyHttp(status, message)
    if (status === 401 || status === 403) return 'AUTH_ERROR'
    if (status === 429) return 'RATE_LIMIT_ERROR'
    if (status >= 500) return 'PROVIDER_ERROR'
    return 'RESPONSE_ERROR'
  }

  function extractText(rawContent) {
    if (shared() && typeof shared().extractTextParts === 'function') return shared().extractTextParts(rawContent)
    return typeof rawContent === 'string' ? rawContent.trim() : ''
  }

  function extractFinalContent(data, message, choice) {
    const fromMessage = extractText(message && message.content)
    if (fromMessage) {
      return {
        content: fromMessage,
        contentType: typeof (message && message.content) === 'string' ? 'string' : 'array',
        source: 'message.content',
      }
    }
    if (message && typeof message.output_text === 'string' && message.output_text.trim()) {
      return { content: message.output_text.trim(), contentType: 'output_text', source: 'message.output_text' }
    }
    if (choice && typeof choice.text === 'string' && choice.text.trim()) {
      return { content: choice.text.trim(), contentType: 'choice.text', source: 'choice.text' }
    }
    return { content: '', contentType: 'empty', source: 'message.content' }
  }

  function responseDebug(data, extras, extracted) {
    if (shared() && typeof shared().safeDebug === 'function') {
      return shared().safeDebug(data, extras, extracted)
    }
    return { provider: extras && extras.provider, model: extras && extras.model }
  }

  function normalizeResponse(data, extras) {
    if (!shared() || typeof shared().normalizeResponse !== 'function') {
      const choice = data && data.choices && data.choices[0]
      const message = (choice && choice.message) || {}
      return {
        content: typeof message.content === 'string' ? message.content.trim() : '',
        reasoningContent: '',
        finishReason: (choice && choice.finish_reason) || '',
        usage: (data && data.usage) || null,
        model: (data && data.model) || (extras && extras.model) || '',
        contentSource: 'MESSAGE_CONTENT',
        debug: { provider: extras && extras.provider, model: extras && extras.model },
      }
    }
    return shared().normalizeResponse(data, extras)
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
