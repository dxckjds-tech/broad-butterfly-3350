;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  ns.bg.providers = ns.bg.providers || {}

  function classifyHttp(status, message) {
    if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/i.test(message || '')) {
      return 'AUTH_ERROR'
    }
    if (status === 429 || status >= 500) return 'CONNECTION_ERROR'
    return 'RESPONSE_ERROR'
  }

  function extractText(rawContent) {
    if (typeof rawContent === 'string') return rawContent.trim()
    if (!Array.isArray(rawContent)) return ''
    return rawContent
      .map(function (part) {
        return (part && (part.text || part.content)) || ''
      })
      .join('')
      .trim()
  }

  function normalizeResponse(data) {
    const choice = data && data.choices && data.choices[0]
    const message = (choice && choice.message) || {}
    return {
      content: extractText(message.content),
      reasoningContent: typeof message.reasoning_content === 'string' ? message.reasoning_content : '',
      finishReason: (choice && choice.finish_reason) || '',
      usage: (data && data.usage) || null,
      model: (data && data.model) || '',
      raw: data,
    }
  }

  function buildRequest(opts) {
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
    if (!response.ok) throw parseError(response.status, data, opts.providerName)
    return normalizeResponse(data)
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
    buildRequest: buildRequest,
    parseError: parseError,
    classifyHttp: classifyHttp,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
