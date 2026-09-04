importScripts('shared/constants.js')

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

async function settings() {
  const saved = await chrome.storage.local.get(null)
  if (saved.apiKey && !saved.deepseekApiKey) saved.deepseekApiKey = saved.apiKey
  return { ...ASD.constants.DEFAULTS, ...saved }
}

async function callAI(messages, maxTokens = 4200) {
  const cfg = await settings()
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
              result: sanitizeModelEvidence(JSON.parse(reasoning.slice(start, end + 1))),
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
        result: sanitizeModelEvidence(JSON.parse(cleaned)),
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
            result: sanitizeModelEvidence(JSON.parse(cleaned.slice(start, end + 1))),
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
  const cfg = await settings()
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

async function imageAsDataUrl(imageUrl) {
  try {
    const url = new URL(imageUrl)
    const supported =
      url.protocol === 'https:' && (url.hostname.endsWith('.made-in-china.com') || url.hostname.endsWith('.vemic.com'))
    if (!supported) return imageUrl
    const response = await fetch(url.href, { credentials: 'include', cache: 'force-cache' })
    if (!response.ok) return imageUrl
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') || blob.size > 2500000) return imageUrl
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 32768)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
    return `data:${blob.type};base64,${btoa(binary)}`
  } catch {
    return imageUrl
  }
}

const IMAGE_FILE_PATTERN = /(?:https?:\/\/\S+|[\w%()+,.@-]+)\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?\S*)?/gi
function stripImageNames(value) {
  return String(value || '')
    .replace(IMAGE_FILE_PATTERN, '[图片内容由视觉模型单独识别]')
    .replace(/C:\\fakepath\\[^\s,;]+/gi, '[已移除图片文件名]')
}
function cleanEvidenceRows(rows) {
  return (rows || [])
    .map(stripImageNames)
    .filter((row) => !/^[^：:]{0,30}[：:]\s*\[(?:图片内容|已移除图片文件名)/.test(row))
}
function sanitizeModelEvidence(result) {
  if (!result || typeof result !== 'object') return result
  const hasFileName = (value) =>
    /\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?|\b)/i.test(String(value || '')) ||
    /图片文件名|image filename/i.test(String(value || ''))
  for (const candidate of result.identityCandidates || []) {
    candidate.support = (candidate.support || []).filter((item) => !hasFileName(item))
    candidate.oppose = (candidate.oppose || []).filter((item) => !hasFileName(item))
  }
  return result
}

async function readUrlInAuthenticatedTab(targetUrl) {
  let url
  try {
    url = new URL(targetUrl)
  } catch {
    return { ok: false, reason: '商品 URL 格式不正确' }
  }
  const supported =
    url.protocol === 'https:' &&
    (url.hostname === 'made-in-china.com' ||
      url.hostname.endsWith('.made-in-china.com') ||
      url.hostname === 'vemic.com' ||
      url.hostname.endsWith('.vemic.com'))
  if (!supported) return { ok: false, reason: '仅支持 VEMIC / Made-in-China 的 HTTPS 商品 URL' }
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false })
  try {
    const loadedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener)
        reject(new Error('URL 页面加载超时（30 秒）'))
      }, 30000)
      const listener = (tabId, info, changedTab) => {
        if (tabId === tab.id && info.status === 'complete') {
          clearTimeout(timer)
          chrome.tabs.onUpdated.removeListener(listener)
          resolve(changedTab)
        }
      }
      chrome.tabs.onUpdated.addListener(listener)
    })
    await chrome.tabs.update(tab.id, { url: url.href })
    await loadedPromise
    const loaded = await chrome.tabs.get(tab.id)
    let fieldsResponse = null
    let bestResponse = null
    let bestScore = -1
    let stableRounds = 0
    let lastMessageError = ''
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      try {
        fieldsResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_MIC_FIELDS' })
        if (fieldsResponse?.loginRequired) {
          bestResponse = fieldsResponse
          break
        }
        if (fieldsResponse?.fields) {
          const fields = fieldsResponse.fields
          const score =
            (fields.title ? 20 : 0) +
            (fields.category ? 10 : 0) +
            Math.min(40, (fields.specs?.length || 0) * 2) +
            Math.min(20, fields.formFields?.length || 0) +
            Math.min(10, Math.floor((fields.visibleText?.length || 0) / 1000))
          if (score > bestScore) {
            bestScore = score
            bestResponse = fieldsResponse
            stableRounds = 0
          } else stableRounds += 1
          if (bestScore >= 45 && stableRounds >= 3) break
        }
      } catch (error) {
        lastMessageError = error.message || String(error)
      }
    }
    fieldsResponse = bestResponse
    if (fieldsResponse?.loginRequired) {
      await chrome.tabs.update(tab.id, { active: true })
      return {
        ok: false,
        loginRequired: true,
        loginUrl: loaded.url,
        reason: '登录会话已失效，请在打开的页面完成登录后重新读取 URL',
        keepTab: true,
      }
    }
    if (!fieldsResponse?.fields)
      return { ok: false, reason: `页面已加载，但数据读取脚本未就绪${lastMessageError ? `：${lastMessageError}` : ''}` }
    return { ok: true, fields: fieldsResponse.fields, url: loaded.url }
  } finally {
    const current = await chrome.tabs.get(tab.id).catch(() => null)
    if (current && !current.active) await chrome.tabs.remove(tab.id).catch(() => {})
  }
}

const SYSTEM_PROMPT = `你是跨境电商商品运营诊断专家。依据用户提供的页面字段完成事实约束诊断。禁止编造搜索量、认证、规格和图片细节；缺失信息必须标为 UNKNOWN 或 NOT_AVAILABLE。

严格遵守以下语言规则：
1. 所有诊断、解释和建议必须使用简体中文，包括 conflicts、nextActions、support、oppose、facts 中的 label/source/note、blocked.reason、candidates.intent/basis、content.titles 中的 style/factsUsed/excluded、debug.missingFields 和 debug.warnings。
2. 可直接修改、替换或复制到英文商品页面的内容必须使用英文，包括商品 identity、候选身份 name、关键词 keyword、content.titles[].text、content.detail 的全部字段、FAQ 的 question/answer 和 GEO 文案。
3. 原始字段值保持原文；状态枚举保持英文大写。
4. 即使输入主要为英文，也不得把诊断原因和操作建议写成英文。
5. confidence、dataCompleteness、contentReadiness、matchScore 必须是 0 到 100 的整数百分数，禁止返回 0 到 1 的小数。
6. 每一个事实、判断和内容卖点都必须能在输入的 title、category、keywords、specs、formFields、description、sku、brand 或 visibleText 中找到依据。不得用行业常识补全产品参数。
7. facts.source 必须写出具体页面字段或原文位置；facts.value 必须沿用输入中的真实数值和单位。没有依据的字段不生成，改放入 debug.missingFields。
8. keywords.candidates 只能评价商品相关度，不得伪造搜索量、热度、竞争度或排名。
9. content.geo 必须是规范化对象，并同时符合已确认产品事实和页面中的真实公司情况。headline/directAnswer 回答产品是什么；productFacts 仅列已验证产品事实；companyContext 仅使用 companyName/companyProfile 中能确认的公司能力；buyerQuestions 提供 3–5 个买家高意图英文问答；sourcingGuidance 给出采购确认事项；evidenceBasis 列出引用的页面字段。不得把行业常识当作公司能力，不得声称搜索排名、市场热度、认证或未验证性能。公司信息缺失时明确写 Company information is not available on the source page，不得虚构。
10. 图片判断必须依据 image_url 中图像像素实际展示的物体、结构、接口、标签和包装，不得依据图片 URL、文件名、上传文件名或 Alt 文本推断。identityCandidates 的图片支持证据必须以“图片视觉识别：”开头，并描述实际看见的外形、部件或文字；禁止出现 jpg/png/webp 等文件名。图片看不清时明确写“图片视觉证据不足”。
11. 若输入包含 userConfirmedIdentity，该值代表用户已确认的商品身份；优先按此身份生成内容，但仍须指出与页面规格或视觉证据的真实冲突。
12. content.detail 禁止返回一整段纯文本，必须按结构化对象输出。overview 为简短介绍；highlights 为 3–6 条重点卖点；specifications 仅放页面有证据的参数并形成 name/value 表格；applications 为适用场景列表；packagingDelivery 汇总真实包装、MOQ、价格或交付信息；buyerNote 提醒买家确认未验证信息。没有依据的部分返回空字符串或空数组，禁止补造。

输出且只输出 JSON，结构如下：
{"summary":{"identity":"string","confidence":0,"dataCompleteness":0,"contentReadiness":0,"status":"VERIFIED|BLOCKED|UNKNOWN","conflicts":["string"],"nextActions":["string"]},"identityCandidates":[{"name":"string","confidence":0,"support":["string"],"oppose":["string"]}],"facts":[{"label":"string","value":"string","status":"VERIFIED|OBSERVED|INFERRED|UNKNOWN","source":"string","note":"string"}],"keywords":{"current":["string"],"blocked":[{"keyword":"string","reason":"string"}],"candidates":[{"keyword":"string","matchScore":0,"intent":"string","basis":"string"}]},"content":{"titles":[{"text":"string","style":"string","factsUsed":["string"],"excluded":["string"]}],"detail":{"headline":"string","overview":"string","highlights":["string"],"specifications":[{"name":"string","value":"string"}],"applications":["string"],"packagingDelivery":"string","buyerNote":"string"},"faq":[{"question":"string","answer":"string"}],"geo":{"headline":"string","directAnswer":"string","productFacts":["string"],"companyContext":"string","buyerQuestions":[{"question":"string","answer":"string"}],"sourcingGuidance":["string"],"evidenceBasis":["string"]}},"debug":{"missingFields":["string"],"warnings":["string"]}}`

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message?.type === 'REQUEST_URL_FIELDS') return await readUrlInAuthenticatedTab(message.url)
    if (message?.type === 'GET_ACTIVE_URL') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return tab?.url ? { ok: true, url: tab.url } : { ok: false, reason: '无法取得当前页面 URL' }
    }
    if (message?.type === 'REQUEST_MIC_FIELDS') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return { ok: false, reason: 'NO_ACTIVE_TAB' }
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_MIC_FIELDS' })
        return response?.fields ? { ok: true, fields: response.fields } : { ok: false, reason: 'NO_FIELDS' }
      } catch {
        return { ok: false, reason: 'CONTENT_SCRIPT_UNAVAILABLE' }
      }
    }
    if (message?.type === 'OPEN_OPTIONS') {
      await chrome.runtime.openOptionsPage()
      return { ok: true }
    }
    if (message?.type === 'TEST_AI') {
      const out = await callAI(
        [
          { role: 'system', content: '请只输出 JSON。' },
          { role: 'user', content: '输出 {"ok":true,"message":"连接成功"}' },
        ],
        100,
      )
      return { ok: out.result?.ok === true, ...out }
    }
    if (message?.type === 'LIST_AI_MODELS') return { ok: true, ...(await listAIModels()) }
    if (message?.type === 'TRANSLATE_TEXT') {
      const sourceText = String(message.text || '')
        .trim()
        .slice(0, 12000)
      if (!sourceText) return { ok: false, reason: '没有可翻译的英文内容' }
      const out = await callAI(
        [
          {
            role: 'system',
            content:
              '你是专业跨境电商翻译。将用户提供的英文忠实翻译为简体中文，保留型号、数字、单位、品牌和段落结构。只输出 JSON：{"translation":"中文译文"}',
          },
          { role: 'user', content: sourceText },
        ],
        1800,
      )
      return { ok: true, translation: out.result?.translation || '', provider: out.provider, model: out.model }
    }
    if (message?.type === 'ANALYZE_PRODUCT') {
      const source = message.fields || {}
      const compactFields = {
        title: stripImageNames(source.title),
        category: stripImageNames(source.category),
        keywords: cleanEvidenceRows(source.keywords),
        specs: cleanEvidenceRows(source.specs).slice(0, 120),
        formFields: cleanEvidenceRows(source.formFields).slice(0, 120),
        certifications: cleanEvidenceRows(source.certifications),
        description: stripImageNames(source.description).slice(0, 5000),
        sku: stripImageNames(source.sku),
        brand: stripImageNames(source.brand),
        companyName: stripImageNames(source.companyName),
        companyProfile: stripImageNames(source.companyProfile).slice(0, 6000),
        visibleText: stripImageNames(source.visibleText).slice(0, 15000),
        imageCount: (source.images || []).length,
        frameCount: source.frameCount,
        url: source.url,
      }
      compactFields.userConfirmedIdentity = source.userConfirmedIdentity || null
      const payload = JSON.stringify(compactFields).slice(0, 30000)
      const cfg = await settings()
      const activeModel = cfg.provider === 'kimi' ? cfg.kimiModel : cfg.deepseekModel
      const visionCapable = /kimi-k3|kimi-k2\.5|vision/i.test(activeModel)
      const visionUrls = visionCapable
        ? await Promise.all((source.images || []).slice(0, 4).map((image) => imageAsDataUrl(image.src)))
        : []
      const imageBlocks = visionUrls.map((url) => ({ type: 'image_url', image_url: { url } }))
      const userContent = imageBlocks.length
        ? [
            {
              type: 'text',
              text: `请结合真实图片像素与以下页面字段完成诊断并输出 JSON。禁止根据图片文件名或 URL 猜测图片内容：\n${payload}`,
            },
            ...imageBlocks,
          ]
        : `请诊断以下商品页面数据并输出 JSON。当前模型未启用视觉能力，不得把图片 URL 当作图片证据：\n${payload}`
      const out = await callAI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ])
      out.visionUsed = imageBlocks.length > 0
      return { ok: true, ...out }
    }
    return { ok: false, reason: 'UNKNOWN_MESSAGE' }
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, reason: error.message }))
  return true
})
