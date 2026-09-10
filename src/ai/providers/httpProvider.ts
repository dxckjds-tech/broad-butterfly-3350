/**
 * Thin HTTP adapters for OpenAI, Gemini, DeepSeek, Kimi, and Claude.
 * Model ids are passed in by the caller. No SDK, no default model name.
 */
import type { TaskCapability } from '../agents/types'
import { capabilitiesForProvider } from './catalog'
import type {
  AgentCompleteRequest,
  AgentCompleteResponse,
  AgentProvider,
  ProviderBinding,
  ProviderId,
} from './types'

export interface ProviderSecrets {
  openai?: string
  gemini?: string
  deepseek?: string
  kimi?: string
  claude?: string
}

export interface HttpProviderOptions {
  binding: ProviderBinding
  secrets: ProviderSecrets
  capabilities?: readonly TaskCapability[]
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const OPENAI_COMPAT_URL: Record<ProviderId, string | null> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
  gemini: null,
  claude: null,
}

function secretFor(id: ProviderId, secrets: ProviderSecrets): string {
  switch (id) {
    case 'openai':
      return secrets.openai ?? ''
    case 'gemini':
      return secrets.gemini ?? ''
    case 'deepseek':
      return secrets.deepseek ?? ''
    case 'kimi':
      return secrets.kimi ?? ''
    case 'claude':
      return secrets.claude ?? ''
  }
}

function withTimeout(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined') return undefined
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(timeoutMs)
  return undefined
}

function unavailable(model: string, detail: string): AgentCompleteResponse {
  return { ok: false, code: 'MODEL_UNAVAILABLE', warning: detail, model }
}

function empty(model: string): AgentCompleteResponse {
  return { ok: false, code: 'EMPTY_RESPONSE', warning: 'Model returned an empty body', model }
}

function timedOut(model: string): AgentCompleteResponse {
  return { ok: false, code: 'TIMEOUT', warning: `Request to model "${model}" timed out`, model }
}

function readOpenAIText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0]
  if (typeof first !== 'object' || first === null) return ''
  const message = (first as { message?: { content?: unknown } }).message
  return typeof message?.content === 'string' ? message.content : ''
}

function readGeminiText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return ''
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return ''
  const first = candidates[0]
  if (typeof first !== 'object' || first === null) return ''
  const content = (first as { content?: { parts?: { text?: string }[] } }).content
  const text = content?.parts?.[0]?.text
  return typeof text === 'string' ? text : ''
}

function readClaudeText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return ''
  const content = (payload as { content?: unknown }).content
  if (!Array.isArray(content) || content.length === 0) return ''
  const first = content[0]
  if (typeof first !== 'object' || first === null) return ''
  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<{ ok: true; json: unknown } | { ok: false; response: AgentCompleteResponse }> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: withTimeout(timeoutMs),
    })
    if (!response.ok) {
      return {
        ok: false,
        response: unavailable('unknown', `HTTP ${response.status} from ${url}`),
      }
    }
    return { ok: true, json: await response.json() }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, response: timedOut('unknown') }
    }
    return {
      ok: false,
      response: unavailable('unknown', error instanceof Error ? error.message : 'Network error'),
    }
  }
}

/**
 * Build an HTTP provider for one binding. Missing API keys surface as
 * MODEL_UNAVAILABLE — the adapter never swaps in a different brand.
 */
export function createHttpProvider(options: HttpProviderOptions): AgentProvider {
  const { binding, secrets } = options
  const capabilities = new Set(options.capabilities ?? capabilitiesForProvider(binding.provider))
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const defaultTimeout = options.timeoutMs ?? 20_000
  const key = secretFor(binding.provider, secrets)

  return {
    id: binding.provider,
    model: binding.model,
    supports(capability) {
      return capabilities.has(capability)
    },
    async complete(request: AgentCompleteRequest): Promise<AgentCompleteResponse> {
      const model = binding.model
      if (!capabilities.has(request.capability)) {
        return {
          ok: false,
          code: 'ROLE_CAPABILITY_MISMATCH',
          warning: `${binding.provider} is not assigned capability ${request.capability}`,
          model,
        }
      }
      if (!key) {
        return unavailable(model, `No API key configured for ${binding.provider}`)
      }
      if (typeof fetchImpl !== 'function') {
        return unavailable(model, 'fetch is not available in this runtime')
      }
      const timeoutMs = request.timeoutMs ?? defaultTimeout
      const imageNote =
        request.images && request.images.length > 0
          ? `\nImages:\n${request.images.map((image) => image.url).join('\n')}`
          : ''
      const prompt = `${request.prompt}${imageNote}`

      if (binding.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
        const posted = await postJson(fetchImpl, url, {}, { contents: [{ parts: [{ text: prompt }] }] }, timeoutMs)
        if (!posted.ok) return { ...posted.response, model }
        const text = readGeminiText(posted.json).trim()
        return text === '' ? empty(model) : { ok: true, text, model }
      }

      if (binding.provider === 'claude') {
        const posted = await postJson(
          fetchImpl,
          'https://api.anthropic.com/v1/messages',
          { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          { model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] },
          timeoutMs,
        )
        if (!posted.ok) return { ...posted.response, model }
        const text = readClaudeText(posted.json).trim()
        return text === '' ? empty(model) : { ok: true, text, model }
      }

      const url = OPENAI_COMPAT_URL[binding.provider]
      if (!url) return unavailable(model, `No HTTP route for ${binding.provider}`)
      const posted = await postJson(
        fetchImpl,
        url,
        { authorization: `Bearer ${key}` },
        { model, messages: [{ role: 'user', content: prompt }] },
        timeoutMs,
      )
      if (!posted.ok) return { ...posted.response, model }
      const text = readOpenAIText(posted.json).trim()
      return text === '' ? empty(model) : { ok: true, text, model }
    },
  }
}
