;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  function charsOf(messages) {
    return JSON.stringify(messages || '').length
  }

  function estimateFromText(inputText, outputText) {
    const inputTokens = Math.max(1, Math.ceil(String(inputText || '').length / 4))
    const outputTokens = Math.max(0, Math.ceil(String(outputText || '').length / 4))
    return {
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimated: true,
    }
  }

  function normalize(raw, extras) {
    const src = raw || {}
    const input = src.inputTokens != null ? src.inputTokens : src.prompt_tokens != null ? src.prompt_tokens : src.input_tokens
    const output = src.outputTokens != null ? src.outputTokens : src.completion_tokens != null ? src.completion_tokens : src.output_tokens
    const total = src.totalTokens != null ? src.totalTokens : src.total_tokens
    if (input != null || output != null || total != null) {
      const inTok = Number(input) || 0
      const outTok = Number(output) || 0
      return {
        inputTokens: inTok,
        outputTokens: outTok,
        totalTokens: Number(total) || inTok + outTok,
        estimated: false,
      }
    }
    const extra = extras || {}
    return estimateFromText(extra.inputText != null ? extra.inputText : charsOf(extra.messages), extra.outputText || extra.content || '')
  }

  ns.bg.tokenAccounting = {
    normalize: normalize,
    estimateFromText: estimateFromText,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
