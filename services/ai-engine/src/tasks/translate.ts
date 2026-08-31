import { createHash } from 'node:crypto';
import type { LLMProvider } from '../provider';

export type TranslationLanguage = 'zh-CN' | 'en';

export interface TranslationResult {
  original: string;
  translated: string;
  targetLanguage: TranslationLanguage;
  cached: boolean;
  provider: string;
  model: string;
}

const cache = new Map<string, Omit<TranslationResult, 'cached'>>();

function key(text: string, targetLanguage: TranslationLanguage): string {
  return createHash('sha256').update(`${targetLanguage}\0${text}`).digest('hex');
}

export function clearTranslationCache(): void {
  cache.clear();
}

export async function translateText(opts: {
  provider: LLMProvider;
  text: string;
  targetLanguage: TranslationLanguage;
  model: string;
}): Promise<TranslationResult> {
  const original = opts.text.trim();
  if (!original || original.length > 12000) throw new Error('INVALID_TRANSLATION_TEXT');
  const cacheKey = key(original, opts.targetLanguage);
  const hit = cache.get(cacheKey);
  if (hit) return { ...hit, cached: true };

  const language = opts.targetLanguage === 'zh-CN' ? 'Simplified Chinese' : 'English';
  const response = await opts.provider.generateText({
    model: opts.model,
    temperature: 0,
    system:
      'You are a precise B2B product translator. Preserve facts, numbers, units, brand names, formatting and terminology. Do not add, omit, explain, optimize, or invent anything. Return only the translation.',
    prompt: `Translate the text below into ${language}.\n\n${original}`,
  });
  const translated = response.text.trim();
  if (!translated) throw new Error('EMPTY_TRANSLATION');
  const stored = {
    original,
    translated,
    targetLanguage: opts.targetLanguage,
    provider: opts.provider.name,
    model: response.model || opts.model,
  };
  cache.set(cacheKey, stored);
  return { ...stored, cached: false };
}
