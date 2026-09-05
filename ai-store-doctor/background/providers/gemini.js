;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}
  ns.bg.providers = ns.bg.providers || {}

  function classifyHttp(status, message) {
    if (status === 401 || status === 403 || /invalid api key|unauthorized|api key/i.test(message || '')) {
      return 'AUTH_ERROR'
    }
    if (status === 429 || status >= 500) return 'CONNECTION_ERROR'
    return 'RESPONSE_ERROR'
  }

  function textOf(content) {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content
      .map(function (part) {
        return (part && (part.text || part.content)) || ''
      })
      .join('')
  }

  function imagePart(url) {
    const raw = String(url || '')
    const match = raw.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return { text: '[image omitted]' }
    return { inlineData: { mimeType: match[1], data: match[2] } }
  }

  function toGeminiPayload(messages) {
    let system = ''
    const contents = []
    ;(messages || []).forEach(function (item) {
      if (!item) return
      if (item.role === 'system') {
        system += (system ? '\n' : '') + textOf(item.content)
        return
      }
      const role = item.role === 'assistant' ? 'model' : 'user'
      const parts = []
      if (typeof item.content === 'string') {
        parts.push({ text: item.content })
      } else if (Array.isArray(item.content)) {
        item.content.forEach(function (part) {
          if (part && part.type === 'image_url') parts.push(imagePart(part.image_url && part.image_url.url))
          else parts.push({ text: (part && (part.text || part.content)) || '' })
        })
      }
      contents.push({ role: role, parts: parts })
    })
    return { system: system, contents: contents }
  }

  function buildRequest(opts) {
    const converted = toGeminiPayload(opts.messages)
    const body = {
      contents: converted.contents,
      generationConfig: {
        maxOutputTokens: opts.maxTokens || 1024,
        temperature: opts.temperature != null ? opts.temperature : 0.2,
        responseMimeType: 'application/json',
      },
    }
    if (converted.system) body.systemInstruction = { parts: [{ text: converted.system }] }
    return body
  }

  function normalizeResponse(data) {
    const candidate = data && data.candidates && data.candidates[0]
    const parts = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : []
    const content = parts
      .map(function (part) {
        return (part && part.text) || ''
      })
      .join('')
      .trim()
    const finish = (candidate && candidate.finishReason) || ''
    const finishReason = finish === 'MAX_TOKENS' ? 'length' : finish === 'STOP' ? 'stop' : String(finish || '').toLowerCase()
    const usage = data && data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount,
          completion_tokens: data.usageMetadata.candidatesTokenCount,
          total_tokens: data.usageMetadata.totalTokenCount,
        }
      : null
    return {
      content: content,
      reasoningContent: '',
      finishReason: finishReason,
      usage: usage,
      model: (data && data.modelVersion) || '',
      raw: data,
    }
  }

  function parseError(status, data, fallbackName) {
    const msg =
      (data && data.error && data.error.message) ||
      (fallbackName || 'Gemini') + ' 请求失败（HTTP ' + status + ')'
    const error = new Error(msg)
    error.status = status
    error.code = classifyHttp(status, msg)
    return error
  }

  function generateUrl(opts) {
    const base = String(opts.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
    const model = encodeURIComponent(opts.model || 'gemini-2.0-flash')
    return base + '/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(opts.apiKey || '')
  }

  async function sendRequest(opts) {
    const response = await fetch(generateUrl(opts), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const base = String(opts.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
    const url = base + '/v1beta/models?key=' + encodeURIComponent(opts.apiKey || '')
    const response = await fetch(url, { cache: 'no-store', signal: opts.signal })
    const data = await response.json().catch(function () {
      return {}
    })
    if (!response.ok) throw parseError(response.status, data, opts.providerName)
    return {
      models: (data.models || [])
        .map(function (item) {
          const name = item && item.name ? String(item.name) : ''
          return name.replace(/^models\//, '')
        })
        .filter(Boolean)
        .sort(),
      raw: data,
    }
  }

  ns.bg.providers.gemini = {
    sendRequest: sendRequest,
    testConnection: testConnection,
    listModels: listModels,
    normalizeResponse: normalizeResponse,
    buildRequest: buildRequest,
    parseError: parseError,
    toGeminiPayload: toGeminiPayload,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
