export type LlmProviderName = 'deepseek' | 'openai' | 'mock' | 'claude' | 'gemini' | 'qwen';

export interface AiRuntimeConfig {
  requestedProvider: LlmProviderName;
  provider: LlmProviderName;
  fallbackReason?: string;
  timeoutMs: number;
  maxRetries: number;
  temperature: number;
  deepseek: {
    apiKey: string;
    baseUrl: string;
    fastModel: string;
    proModel: string;
  };
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

function asProvider(raw: string | undefined): LlmProviderName {
  const v = (raw ?? 'deepseek').toLowerCase().trim();
  if (v === 'openai' || v === 'deepseek' || v === 'mock' || v === 'claude' || v === 'gemini' || v === 'qwen') {
    return v;
  }
  if (v === 'anthropic') return 'claude';
  return 'deepseek';
}

export function loadAiConfig(env: NodeJS.Dict<string> = process.env): AiRuntimeConfig {
  const requestedProvider = asProvider(env.LLM_PROVIDER);
  const timeoutMs = Math.max(1000, Number(env.AI_TIMEOUT ?? env.LLM_TIMEOUT ?? 30000) || 30000);
  const maxRetries = Math.max(0, Number(env.AI_MAX_RETRIES ?? env.LLM_MAX_RETRIES ?? 2) || 2);
  const temperature = Number(env.LLM_TEMPERATURE ?? 0.2);
  const deepseekKey = (env.DEEPSEEK_API_KEY ?? '').trim();
  const openaiKey = (env.OPENAI_API_KEY ?? '').trim();

  const config: AiRuntimeConfig = {
    requestedProvider,
    provider: requestedProvider,
    timeoutMs,
    maxRetries,
    temperature: Number.isFinite(temperature) ? temperature : 0.2,
    deepseek: {
      apiKey: deepseekKey,
      baseUrl: (env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
      fastModel: env.DEEPSEEK_FAST_MODEL || 'deepseek-v4-flash',
      proModel: env.DEEPSEEK_PRO_MODEL || 'deepseek-v4-pro',
    },
    openai: {
      apiKey: openaiKey,
      baseUrl: (env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
      model: env.LLM_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini',
    },
  };

  if (requestedProvider === 'deepseek' && !deepseekKey) {
    config.provider = 'mock';
    config.fallbackReason = 'DEEPSEEK_API_KEY missing';
  } else if (requestedProvider === 'openai' && !openaiKey) {
    config.provider = 'mock';
    config.fallbackReason = 'OPENAI_API_KEY missing';
  } else if (requestedProvider === 'claude' || requestedProvider === 'gemini' || requestedProvider === 'qwen') {
    config.provider = 'mock';
    config.fallbackReason = `${requestedProvider} is not enabled in this phase`;
  }

  return config;
}

export function hasSecretLeak(text: string): boolean {
  return /sk-[A-Za-z0-9]{10,}|DEEPSEEK_API_KEY|OPENAI_API_KEY/i.test(text);
}
