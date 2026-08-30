import type { AiRuntimeConfig } from '../config';
import { parseJsonLoose } from '../json';
import type { GenerateStructuredInput, GenerateStructuredResult, GenerateTextInput, GenerateTextResult, LlmUsage } from '../provider';

export interface CompatClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  defaultModel: string;
  provider: string;
  extraBody?: Record<string, unknown>;
}

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usageFrom(payload: Record<string, unknown>): LlmUsage {
  const usage = (payload.usage ?? {}) as Record<string, unknown>;
  return {
    inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0,
    outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0,
  };
}

function contentFrom(payload: Record<string, unknown>): string {
  const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content;
  if (typeof text === 'string') return text;
  throw new ProviderHttpError('Empty model content', undefined, 'EMPTY_CONTENT');
}

export function normalizeChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/chat/completions`;
}

export async function chatCompletions(
  opts: CompatClientOptions,
  input: {
    model: string;
    system?: string;
    prompt: string;
    temperature: number;
    json?: boolean;
    jsonSchema?: Record<string, unknown>;
    schemaName?: string;
  },
): Promise<{ text: string; model: string; usage: LlmUsage }> {
  if (!opts.apiKey) {
    throw new ProviderHttpError('API key missing', 401, 'NO_API_KEY');
  }

  const url = normalizeChatCompletionsUrl(opts.baseUrl);
  const messages = [
    ...(input.system ? [{ role: 'system', content: input.system }] : []),
    { role: 'user', content: input.prompt },
  ];

  let responseFormat: Record<string, unknown> | undefined;
  if (input.jsonSchema && opts.provider === 'openai') {
    responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: input.schemaName || 'result',
        strict: true,
        schema: input.jsonSchema,
      },
    };
  } else if (input.json || input.jsonSchema) {
    responseFormat = { type: 'json_object' };
  }

  const body: Record<string, unknown> = {
    model: input.model,
    messages,
    temperature: input.temperature,
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...opts.extraBody,
  };

  let lastError: unknown;
  const attempts = opts.maxRetries + 1;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const rawText = await res.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        payload = { error: { message: rawText.slice(0, 200) } };
      }
      if (!res.ok) {
        const err = payload.error as { message?: string; code?: string } | undefined;
        const msg = err?.message || res.statusText || 'provider error';
        const code = err?.code || String(res.status);
        if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
          await sleep(400 * 2 ** i);
          continue;
        }
        throw new ProviderHttpError(msg, res.status, code);
      }
      const text = contentFrom(payload);
      return { text, model: String(payload.model ?? input.model), usage: usageFrom(payload) };
    } catch (err) {
      lastError = err;
      if (err instanceof ProviderHttpError) throw err;
      if (i < attempts - 1) {
        await sleep(400 * 2 ** i);
        continue;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderHttpError('LLM timeout', 408, 'TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new ProviderHttpError('provider unavailable', 503, 'UNAVAILABLE');
}

export async function structuredFromChat(
  opts: CompatClientOptions,
  input: GenerateStructuredInput,
  temperature: number,
): Promise<GenerateStructuredResult> {
  const first = await chatCompletions(opts, {
    model: input.model || opts.defaultModel,
    system: input.system,
    prompt: `${input.prompt}\n\nReturn a JSON object named ${input.schemaName}.`,
    temperature,
    json: true,
    jsonSchema: input.jsonSchema,
    schemaName: input.schemaName,
  });
  try {
    return {
      data: parseJsonLoose(first.text),
      raw: first.text,
      model: first.model,
      usage: first.usage,
      repaired: false,
    };
  } catch {
    const repair = await chatCompletions(opts, {
      model: input.model || opts.defaultModel,
      system: 'Return valid JSON only. Do not wrap in markdown.',
      prompt: `Repair this into valid JSON matching schema ${input.schemaName}:\n${first.text}`,
      temperature: 0,
      json: true,
      jsonSchema: input.jsonSchema,
      schemaName: input.schemaName,
    });
    return {
      data: parseJsonLoose(repair.text),
      raw: repair.text,
      model: repair.model,
      usage: {
        inputTokens: first.usage.inputTokens + repair.usage.inputTokens,
        outputTokens: first.usage.outputTokens + repair.usage.outputTokens,
      },
      repaired: true,
    };
  }
}

export async function textFromChat(
  opts: CompatClientOptions,
  input: GenerateTextInput,
  temperature: number,
): Promise<GenerateTextResult> {
  const out = await chatCompletions(opts, {
    model: input.model || opts.defaultModel,
    system: input.system,
    prompt: input.prompt,
    temperature: input.temperature ?? temperature,
    json: input.json,
  });
  return { text: out.text, model: out.model, usage: out.usage };
}

export function clientFromConfig(
  config: AiRuntimeConfig,
  which: 'deepseek' | 'openai',
): CompatClientOptions {
  if (which === 'openai') {
    return {
      apiKey: config.openai.apiKey,
      baseUrl: config.openai.baseUrl,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      defaultModel: config.openai.model,
      provider: 'openai',
    };
  }
  return {
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    defaultModel: config.deepseek.fastModel,
    provider: 'deepseek',
    extraBody: { thinking: { type: 'disabled' } },
  };
}
