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

  function textOf(content) {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content
      .map(function (part) {
        if (!part) return ''
        if (part.type === 'text') return part.text || ''
        if (part.text) return part.text
        return ''
      })
      .join('')
  }

  function imagePart(url) {
    const raw = String(url || '')
    const match = raw.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return { type: 'text', text: '[image omitted]' }
    return {
      type: 'image',
      source: { type: 'base64', media_type: match[1], data: match[2] },
    }
  }

  function toAnthropicMessages(messages) {
    let system = ''
    const out = []
    ;(messages || []).forEach(function (item) {
      if (!item) return
      if (item.role === 'system') {
        system += (system ? '\n' : '') + textOf(item.content)
        return
      }
      const role = item.role === 'assistant' ? 'assistant' : 'user'
      if (typeof item.content === 'string') {
        out.push({ role: role, content: item.content })
        return
      }
      if (Array.isArray(item.content)) {
        out.push({
          role: role,
          content: item.content.map(function (part) {
            if (part && part.type === 'image_url') {
              return imagePart(part.image_url && part.image_url.url)
            }
            return { type: 'text', text: (part && (part.text || part.content)) || '' }
          }),
        })
      }
    })
    return { system: system, messages: out }
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

  function buildRequest(opts) {
    const allowVision = !!(opts.capabilities && opts.capabilities.vision === true)
    const converted = toAnthropicMessages(allowVision ? opts.messages : stripImageParts(opts.messages))
    const body = {
      model: opts.model,
      max_tokens: opts.maxTokens || 1024,
      messages: converted.messages,
    }
    if (converted.system) body.system = converted.system
    const temp = resolveTemperature(opts)
    if (temp.send) body.temperature = temp.value
    return body
  }

  function normalizeResponse(data, extras) {
    const content = textOf(data && data.content).trim()
    const stop = (data && data.stop_reason) || ''
    const finishReason = stop === 'max_tokens' ? 'length' : stop === 'end_turn' || stop === 'stop_sequence' ? 'stop' : stop
    const usage = data && data.usage ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens } : null
    const shaped = {
      model: (data && data.model) || '',
      usage: usage,
      choices: [{ message: { content: content }, finish_reason: finishReason }],
    }
    if (ASD.responseNormalize && typeof ASD.responseNormalize.normalizeResponse === 'function') {
      return ASD.responseNormalize.normalizeResponse(shaped, Object.assign({ provider: 'Anthropic' }, extras || {}))
    }
    return {
      content: content,
      reasoningContent: '',
      finishReason: finishReason,
      usage: usage,
      model: (data && data.model) || '',
      contentSource: 'MESSAGE_CONTENT',
    }
  }

  function parseError(status, data, fallbackName) {
    const msg =
      (data && data.error && data.error.message) ||
      (fallbackName || 'Anthropic') + ' 请求失败（HTTP ' + status + ')'
    const error = new Error(msg)
    error.status = status
    error.code = classifyHttp(status, msg)
    return error
  }

  async function sendRequest(opts) {
    const url = String(opts.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
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
    return sendRequest(Object.assign({}, opts, { maxTokens: opts.maxTokens || 512 }))
  }

  async function listModels(opts) {
    const url = String(opts.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/models'
    const response = await fetch(url, {
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
      signal: opts.signal,
    })
    const data = await response.json().catch(function () {
      return {}
    })
    if (!response.ok) throw parseError(response.status, data, opts.providerName)
    const rows = data.data || data.models || []
    return {
      models: rows
        .map(function (item) {
          return item && (item.id || item.name)
        })
        .filter(Boolean)
        .sort(),
      raw: data,
    }
  }

  ns.bg.providers.anthropic = {
    sendRequest: sendRequest,
    testConnection: testConnection,
    listModels: listModels,
    normalizeResponse: normalizeResponse,
    buildRequest: buildRequest,
    parseError: parseError,
    toAnthropicMessages: toAnthropicMessages,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
