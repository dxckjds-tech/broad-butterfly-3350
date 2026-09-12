;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const CONTENT_SOURCES = {
    MESSAGE_CONTENT: 'MESSAGE_CONTENT',
    ARRAY_TEXT: 'ARRAY_TEXT',
    PROVIDER_FIELD: 'PROVIDER_FIELD',
    REASONING_RECOVERY: 'REASONING_RECOVERY',
    THINKING_RECOVERY: 'THINKING_RECOVERY',
    TRUNCATION_REPAIR: 'TRUNCATION_REPAIR',
    EMPTY: 'EMPTY',
  }

  const REASONING_PART_TYPES = { reasoning: true, thinking: true, thought: true }

  function objectKeys(value) {
    if (!value || typeof value !== 'object') return []
    return Object.keys(value).slice(0, 24)
  }

  function contentTypeOf(rawContent) {
    if (typeof rawContent === 'string') return 'string'
    if (Array.isArray(rawContent)) return 'array'
    if (rawContent == null) return 'empty'
    return typeof rawContent
  }

  function partTypesOf(rawContent) {
    if (!Array.isArray(rawContent)) return []
    return rawContent
      .map(function (part) {
        if (typeof part === 'string') return 'string'
        return String((part && part.type) || 'unknown')
      })
      .slice(0, 12)
  }

  function extractTextParts(rawContent) {
    if (typeof rawContent === 'string') return rawContent.trim()
    if (!Array.isArray(rawContent)) return ''
    return rawContent
      .map(function (part) {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const partType = String(part.type || '').toLowerCase()
        if (REASONING_PART_TYPES[partType]) return ''
        if (partType === 'text' || partType === 'output_text') return part.text || part.content || ''
        return part.text || (typeof part.content === 'string' ? part.content : '')
      })
      .join('')
      .trim()
  }

  function extractThinkingParts(rawContent) {
    if (!Array.isArray(rawContent)) return ''
    return rawContent
      .map(function (part) {
        if (!part || typeof part !== 'object') return ''
        const partType = String(part.type || '').toLowerCase()
        if (!REASONING_PART_TYPES[partType]) return ''
        return part.text || part.content || part.thinking || ''
      })
      .join('')
      .trim()
  }

  function firstString(values) {
    for (let i = 0; i < values.length; i += 1) {
      if (typeof values[i] === 'string' && values[i].trim()) return values[i].trim()
    }
    return ''
  }

  function repairTruncatedJson(text) {
    const raw = String(text || '').trim()
    if (!raw) return { ok: false, text: '', repaired: false }
    const start = raw.indexOf('{')
    if (start < 0) return { ok: false, text: raw, repaired: false }
    let body = raw.slice(start)
    body = body.replace(/,(\s*)$/g, '$1')
    const lastColon = body.lastIndexOf(':')
    const lastComma = body.lastIndexOf(',')
    const lastQuote = body.lastIndexOf('"')
    if (lastColon > lastComma && lastQuote > lastColon) {
      const afterColon = body.slice(lastColon + 1).trim()
      if (afterColon && !/^".*"$/.test(afterColon) && !/^[0-9.\-]+$/.test(afterColon) && !/^(true|false|null)$/.test(afterColon)) {
        body = body.slice(0, lastComma >= 0 ? lastComma : lastColon)
      }
    }
    const opens = (body.match(/\{/g) || []).length
    const closes = (body.match(/\}/g) || []).length
    const openArr = (body.match(/\[/g) || []).length
    const closeArr = (body.match(/\]/g) || []).length
    let repaired = body
    if (repaired.charAt(repaired.length - 1) === ',') repaired = repaired.slice(0, -1)
    for (let i = 0; i < openArr - closeArr; i += 1) repaired += ']'
    for (let j = 0; j < opens - closes; j += 1) repaired += '}'
    try {
      JSON.parse(repaired)
      return { ok: true, text: repaired, repaired: repaired !== raw }
    } catch (e) {
      return { ok: false, text: raw, repaired: false }
    }
  }

  function isParamRejectedMessage(message) {
    const msg = String(message || '')
    if (!msg) return false
    if (/invalid[_\s-]?temperature|temperature.*(only|must|allowed|unsupported|invalid)|unsupported temperature/i.test(msg)) {
      return true
    }
    if (/response_format.*(unsupport|invalid|not supported|unknown)|json_object.*(unsupport|not supported)/i.test(msg)) {
      return true
    }
    if (/thinking.*(unsupport|not supported|invalid)|reasoning_effort.*(unsupport|not supported)/i.test(msg)) {
      return true
    }
    if (/unknown parameter|unsupported parameter|invalid parameter|unrecognized (request )?parameter/i.test(msg)) {
      return true
    }
    return false
  }

  function classifyHttp(status, message) {
    const msg = String(message || '')
    if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/i.test(msg)) {
      return 'AUTH_ERROR'
    }
    if (status === 429 || /rate limit|too many requests/i.test(msg)) return 'RATE_LIMIT_ERROR'
    if (/quota|insufficient.?quota|billing|exceeded your current quota/i.test(msg)) return 'QUOTA_ERROR'
    if (/content.?filter|safety|blocked by|output blocked|responsibleai/i.test(msg)) return 'CONTENT_FILTERED'
    if (isParamRejectedMessage(msg) || (status === 400 && isParamRejectedMessage(msg))) return 'PARAM_REJECTED'
    if (status === 400 && /temperature|response_format|thinking|parameter/i.test(msg)) return 'PARAM_REJECTED'
    if (status === 404 && /model/i.test(msg)) return 'MODEL_NOT_FOUND'
    if (status >= 500) return 'PROVIDER_ERROR'
    return 'RESPONSE_ERROR'
  }

  function learnableTemperature(message) {
    const msg = String(message || '')
    const only = msg.match(/temperature[^\d]{0,24}(?:only|must be|allowed(?: value)?(?: is)?)\s*([0-9]*\.?[0-9]+)/i)
    if (only) return { mode: 'fixed', value: Number(only[1]), supported: true, fixedValue: Number(only[1]) }
    if (/temperature.*(not supported|unsupported)/i.test(msg)) return { mode: 'unsupported', supported: false }
    return null
  }

  function emptyChoices(data) {
    return !data || !Array.isArray(data.choices) || data.choices.length === 0
  }

  function safeDebug(data, extras, extracted) {
    const extra = extras || {}
    const choice = data && data.choices && data.choices[0]
    const message = (choice && choice.message) || extra.message || {}
    return {
      provider: extra.provider || extra.providerName || '',
      model: (data && data.model) || extra.model || '',
      status: extra.httpStatus != null ? extra.httpStatus : extra.status != null ? extra.status : 200,
      httpStatus: extra.httpStatus != null ? extra.httpStatus : extra.status != null ? extra.status : 200,
      finishReason: (choice && choice.finish_reason) || extra.finishReason || '',
      contentType: extracted && extracted.contentType ? extracted.contentType : contentTypeOf(message.content),
      contentLength: extracted && extracted.content ? extracted.content.length : 0,
      partTypes: partTypesOf(message.content),
      reasoningLength: extracted && extracted.reasoningContent ? extracted.reasoningContent.length : 0,
      messageKeys: objectKeys(message),
      usage: data && data.usage ? objectKeys(data.usage) : [],
      contentSource: (extracted && extracted.contentSource) || CONTENT_SOURCES.EMPTY,
      requestShape: extra.requestShape || '',
      errorClass: extra.errorClass || '',
      choicesCount: data && Array.isArray(data.choices) ? data.choices.length : extra.choicesCount || 0,
      hasReasoningContent: !!(message.reasoning_content || message.reasoning || message.thinking || extra.reasoningContent),
      topLevelKeys: objectKeys(data),
    }
  }

  function toOpenAiShape(data, extras) {
    if (data && Array.isArray(data.choices)) return data
    const extra = extras || {}
    if (typeof extra.toOpenAi === 'function') return extra.toOpenAi(data) || { choices: [] }
    return data || { choices: [] }
  }

  function extractLadder(data, extras) {
    const extra = extras || {}
    const shaped = toOpenAiShape(data, extra)
    if (emptyChoices(shaped) && !extra.allowEmptyChoices) {
      return {
        content: '',
        reasoningContent: '',
        finishReason: extra.finishReason || '',
        contentType: 'empty',
        contentSource: CONTENT_SOURCES.EMPTY,
        errorClass: 'EMPTY_CHOICES',
        shaped: shaped,
      }
    }
    const choice = (shaped && shaped.choices && shaped.choices[0]) || {}
    const message = choice.message || {}
    const reasoning = firstString([message.reasoning_content, message.reasoning, extra.reasoningContent])
    const thinkingBlock = firstString([message.thinking, extractThinkingParts(message.content), extra.thinkingContent])
    const finishReason = choice.finish_reason || extra.finishReason || ''

    if (typeof extra.extractHook === 'function') {
      const hooked = extra.extractHook(shaped, message, choice) || {}
      if (hooked.content) {
        return {
          content: hooked.content,
          reasoningContent: reasoning || thinkingBlock,
          finishReason: finishReason,
          contentType: hooked.contentType || contentTypeOf(message.content),
          contentSource: hooked.contentSource || CONTENT_SOURCES.PROVIDER_FIELD,
          errorClass: '',
          shaped: shaped,
        }
      }
    }

    if (typeof message.content === 'string' && message.content.trim()) {
      return {
        content: message.content.trim(),
        reasoningContent: reasoning || thinkingBlock,
        finishReason: finishReason,
        contentType: 'string',
        contentSource: CONTENT_SOURCES.MESSAGE_CONTENT,
        errorClass: '',
        shaped: shaped,
      }
    }

    const arrayText = extractTextParts(message.content)
    if (arrayText) {
      return {
        content: arrayText,
        reasoningContent: reasoning || thinkingBlock,
        finishReason: finishReason,
        contentType: 'array',
        contentSource: CONTENT_SOURCES.ARRAY_TEXT,
        errorClass: '',
        shaped: shaped,
      }
    }

    const providerField = firstString([
      message.output_text,
      choice.text,
      shaped && shaped.output_text,
      extra.finalContent,
    ])
    if (providerField) {
      return {
        content: providerField,
        reasoningContent: reasoning || thinkingBlock,
        finishReason: finishReason,
        contentType: 'output_text',
        contentSource: CONTENT_SOURCES.PROVIDER_FIELD,
        errorClass: '',
        shaped: shaped,
      }
    }

    if (reasoning) {
      return {
        content: reasoning,
        reasoningContent: reasoning,
        finishReason: finishReason,
        contentType: contentTypeOf(message.content),
        contentSource: CONTENT_SOURCES.REASONING_RECOVERY,
        errorClass: '',
        shaped: shaped,
        recovered: true,
      }
    }

    if (thinkingBlock) {
      return {
        content: thinkingBlock,
        reasoningContent: thinkingBlock,
        finishReason: finishReason,
        contentType: contentTypeOf(message.content),
        contentSource: CONTENT_SOURCES.THINKING_RECOVERY,
        errorClass: '',
        shaped: shaped,
        recovered: true,
      }
    }

    return {
      content: '',
      reasoningContent: '',
      finishReason: finishReason,
      contentType: contentTypeOf(message.content),
      contentSource: CONTENT_SOURCES.EMPTY,
      errorClass: finishReason === 'length' ? 'OUTPUT_TRUNCATED' : 'EMPTY_FINAL_CONTENT',
      shaped: shaped,
    }
  }

  function normalizeResponse(data, extras) {
    const extra = extras || {}
    const extracted = extractLadder(data, extra)
    let content = extracted.content
    let contentSource = extracted.contentSource
    if ((extracted.finishReason === 'length' || extra.repairTruncation) && content) {
      const repaired = repairTruncatedJson(content)
      if (repaired.ok && repaired.repaired) {
        content = repaired.text
        contentSource = CONTENT_SOURCES.TRUNCATION_REPAIR
      }
    }
    const debug = safeDebug(extracted.shaped || data, extra, {
      content: content,
      contentType: extracted.contentType,
      contentSource: contentSource,
      reasoningContent: extracted.reasoningContent,
    })
    debug.errorClass = extracted.errorClass || extra.errorClass || ''
    return {
      content: content,
      reasoningContent: extracted.reasoningContent || '',
      finishReason: extracted.finishReason || '',
      usage: (data && data.usage) || extra.usage || null,
      model: (data && data.model) || extra.model || '',
      contentSource: contentSource,
      recovered: !!extracted.recovered || contentSource === CONTENT_SOURCES.REASONING_RECOVERY || contentSource === CONTENT_SOURCES.THINKING_RECOVERY,
      errorClass: extracted.errorClass || '',
      debug: debug,
    }
  }

  function isRecognizableContent(text) {
    const raw = String(text || '').trim()
    if (!raw) return false
    if (raw.length >= 2) return true
    return false
  }

  function connectionLevels(normalized) {
    const content = normalized && normalized.content
    const liveness = !!(normalized && isRecognizableContent(content))
    let structured = 'fail'
    if (liveness) {
      try {
        const parsed = JSON.parse(
          String(content)
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim(),
        )
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) structured = parsed.ok === true ? 'ok' : 'limited'
        else structured = 'limited'
      } catch (e) {
        structured = 'limited'
      }
    }
    return {
      liveness: liveness ? 'ok' : 'fail',
      structured: structured,
      contentSource: (normalized && normalized.contentSource) || CONTENT_SOURCES.EMPTY,
    }
  }

  ns.responseNormalize = {
    CONTENT_SOURCES: CONTENT_SOURCES,
    normalizeResponse: normalizeResponse,
    extractTextParts: extractTextParts,
    repairTruncatedJson: repairTruncatedJson,
    classifyHttp: classifyHttp,
    isParamRejectedMessage: isParamRejectedMessage,
    learnableTemperature: learnableTemperature,
    safeDebug: safeDebug,
    connectionLevels: connectionLevels,
    isRecognizableContent: isRecognizableContent,
    contentTypeOf: contentTypeOf,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
