;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  async function callAI(messages, maxTokens = 4200) {
    const cfg = await ASD.bg.settings.load()
    const isKimi = cfg.provider === 'kimi'
    const apiKey = isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey
    const providerName = isKimi ? 'Kimi' : 'DeepSeek'
    if (!apiKey) throw new Error(`请先在设置页填写 ${providerName} API Key`)
    const baseUrl = isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl
    const model = isKimi ? cfg.kimiModel : cfg.deepseekModel
    const isK3 = isKimi && /kimi-k3/i.test(model)
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
    let lastReason = '空内容'
    let lastFinishReason = ''
    const deadline = Date.now() + (isK3 ? 125000 : 55000)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remaining = deadline - Date.now()
      if (remaining < 3000) break
      const retryMessages =
        attempt === 0
          ? messages
          : [
              ...messages,
              {
                role: 'user',
                content: `上一次响应${lastReason}。请立即重新输出完整、非空、可解析的 JSON 对象，不要使用 Markdown 代码块。`,
              },
            ]
      const body = {
        model,
        messages: retryMessages,
        max_tokens: isK3 ? Math.max(maxTokens, 6000) : maxTokens,
        temperature: isKimi ? 1 : 0.2,
      }
      if (!isK3 && attempt < 2) body.response_format = { type: 'json_object' }
      if (!isKimi) body.thinking = { type: cfg.deepseekThinking }
      else if (/kimi-k2\.5/i.test(model)) body.thinking = { type: 'disabled' }
      else if (isK3) body.reasoning_effort = 'low'
      const controller = new AbortController()
      const requestTimeout = setTimeout(
        () => controller.abort(),
        Math.min(isK3 ? (attempt === 0 ? 90000 : 30000) : attempt === 0 ? 35000 : 15000, remaining),
      )
      let response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      } catch (error) {
        clearTimeout(requestTimeout)
        if (error.name === 'AbortError') {
          lastReason = '请求超时'
          continue
        }
        throw error
      }
      clearTimeout(requestTimeout)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error?.message || `${providerName} API 请求失败（HTTP ${response.status}）`)
      const message = data?.choices?.[0]?.message || {}
      lastFinishReason = data?.choices?.[0]?.finish_reason || ''
      const rawContent = message.content
      const content = (
        typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map((part) => part?.text || part?.content || '').join('')
            : ''
      ).trim()
      if (!content) {
        const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : ''
        if (reasoning) {
          const start = reasoning.indexOf('{'),
            end = reasoning.lastIndexOf('}')
          if (start >= 0 && end > start) {
            try {
              return {
                result: ASD.bg.payloadBuilder.sanitizeModelEvidence(JSON.parse(reasoning.slice(start, end + 1))),
                usage: data.usage || null,
                model: data.model || model,
                provider: providerName,
                attempts: attempt + 1,
              }
            } catch {}
          }
        }
        lastReason = `为空${lastFinishReason ? `（finish_reason: ${lastFinishReason}）` : ''}`
        continue
      }
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      try {
        return {
          result: ASD.bg.payloadBuilder.sanitizeModelEvidence(JSON.parse(cleaned)),
          usage: data.usage || null,
          model: data.model || model,
          provider: providerName,
          attempts: attempt + 1,
        }
      } catch {
        const start = cleaned.indexOf('{'),
          end = cleaned.lastIndexOf('}')
        if (start >= 0 && end > start) {
          try {
            return {
              result: ASD.bg.payloadBuilder.sanitizeModelEvidence(JSON.parse(cleaned.slice(start, end + 1))),
              usage: data.usage || null,
              model: data.model || model,
              provider: providerName,
              attempts: attempt + 1,
            }
          } catch {}
        }
        lastReason = '不是有效 JSON'
      }
    }
    throw new Error(
      `${providerName} 未返回有效最终内容${lastFinishReason ? `（finish_reason: ${lastFinishReason}）` : ''}。${isK3 ? 'K3 已等待最多 125 秒，请检查账号额度或改用 K2/非思考模型' : '请重试或切换模型'}`,
    )
  }

  async function listAIModels() {
    const cfg = await ASD.bg.settings.load()
    const isKimi = cfg.provider === 'kimi'
    const apiKey = isKimi ? cfg.kimiApiKey : cfg.deepseekApiKey
    const baseUrl = isKimi ? cfg.kimiBaseUrl : cfg.deepseekBaseUrl
    const providerName = isKimi ? 'Kimi' : 'DeepSeek'
    if (!apiKey) throw new Error(`请先填写 ${providerName} API Key`)
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error?.message || `获取模型失败（HTTP ${response.status}）`)
    return {
      provider: providerName,
      models: (data.data || [])
        .map((item) => item.id)
        .filter(Boolean)
        .sort(),
    }
  }

  ns.bg.aiClient = { callAI, listAIModels }
})(typeof globalThis !== 'undefined' ? globalThis : self)
