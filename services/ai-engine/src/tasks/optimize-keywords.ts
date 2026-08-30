import {
  KEYWORD_OPTIMIZER_PROMPT_VERSION,
  KEYWORD_OPTIMIZER_SYSTEM,
  buildKeywordOptimizerUserPrompt,
} from '@trade-ai/prompts';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { applyFactGuard } from '../fact-guard';
import { parseJsonLoose } from '../json';
import { routeModel } from '../model-router';
import { AI_ENGINE_VERSION, ENABLED_AI_TASKS } from '../provider';
import type { LLMProvider } from '../provider';
import {
  KEYWORD_JSON_SCHEMA,
  KeywordOptimizeOutputSchema,
  coerceKeywordOutput,
  isBannedHotTerm,
  isCenterTermRepeat,
  wordCount,
  type KeywordOptimizeOutput,
} from '../schemas/keyword';
import { AiUnavailableError } from './optimize-title';

export interface KeywordOptimizeInput {
  productName: string;
  category?: string;
  currentKeywords?: string[];
  keywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  moq?: string;
  deliveryTime?: string;
}

export interface KeywordOptimizeResult {
  currentKeywords: string[];
  problems: string[];
  primaryKeywords: KeywordOptimizeOutput['primaryKeywords'];
  secondaryKeywords: KeywordOptimizeOutput['secondaryKeywords'];
  buyerIntentKeywords: KeywordOptimizeOutput['buyerIntentKeywords'];
  applicationKeywords: KeywordOptimizeOutput['applicationKeywords'];
  micKeywords: KeywordOptimizeOutput['micKeywords'];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: 'KEYWORD_OPTIMIZATION';
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    status: 'ok' | 'cached' | 'fallback';
    promptVersion: string;
    cached: boolean;
    engineVersion: string;
  };
}

function knownCorpus(input: KeywordOptimizeInput): string {
  return [
    input.productName,
    input.category,
    ...(input.currentKeywords ?? input.keywords ?? []),
    ...(input.centerTerms ?? []),
    input.description,
    ...Object.entries(input.specifications ?? {}).map(([k, v]) => `${k} ${v}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function sanitizeMicKeywords(
  items: KeywordOptimizeOutput['micKeywords'],
  input: KeywordOptimizeInput,
): { list: KeywordOptimizeOutput['micKeywords']; warnings: string[] } {
  const center = input.centerTerms ?? [];
  const allowed = knownCorpus(input);
  const seen = new Set<string>();
  const warnings: string[] = [];
  const list: KeywordOptimizeOutput['micKeywords'] = [];

  for (const item of items) {
    const keyword = item.keyword.replace(/\s+/g, ' ').trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    if (wordCount(keyword) > 6) {
      warnings.push(`Dropped stuffed keyword "${keyword}"`);
      continue;
    }
    if (isCenterTermRepeat(keyword, center)) {
      warnings.push(`Dropped center-term repeat "${keyword}"`);
      continue;
    }
    if (isBannedHotTerm(keyword, allowed)) {
      warnings.push(`Dropped unrelated hot term "${keyword}"`);
      continue;
    }
    const guarded = applyFactGuard(keyword, {
      productName: input.productName,
      category: input.category,
      keywords: input.currentKeywords ?? input.keywords,
      centerTerms: input.centerTerms,
      specifications: input.specifications,
      description: input.description,
      certifications: input.certifications,
      moq: input.moq,
      deliveryTime: input.deliveryTime,
    });
    if (!guarded.ok) {
      warnings.push(...guarded.warnings);
      continue;
    }
    seen.add(key);
    list.push({
      keyword: guarded.cleaned || keyword,
      priority: list.length < 3 ? 'HIGH' : 'MEDIUM',
      reason: item.reason,
    });
    if (list.length >= 10) break;
  }

  return { list, warnings };
}

export async function optimizeKeywords(opts: {
  provider: LLMProvider;
  config: AiRuntimeConfig;
  input: KeywordOptimizeInput;
  skipCache?: boolean;
}): Promise<KeywordOptimizeResult> {
  if (!ENABLED_AI_TASKS.has('KEYWORD_OPTIMIZATION')) {
    throw new AiUnavailableError();
  }

  const productName = opts.input.productName.trim();
  if (!productName) {
    throw new AiUnavailableError('产品标题为空，无法优化关键词。');
  }

  const currentKeywords = (opts.input.currentKeywords ?? opts.input.keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean);
  const key = cacheKey(['KEYWORD_OPTIMIZATION', opts.input.url, productName, currentKeywords.join(',')]);
  if (!opts.skipCache) {
    const hit = getCached<KeywordOptimizeResult>(key);
    if (hit) {
      return { ...hit, meta: { ...hit.meta, cached: true, status: 'cached' } };
    }
  }

  const started = Date.now();
  const routed = routeModel('KEYWORD_OPTIMIZATION', opts.config);
  const prompt = buildKeywordOptimizerUserPrompt({
    productName,
    category: opts.input.category ?? '',
    currentKeywords,
    centerTerms: opts.input.centerTerms ?? [],
    specifications: opts.input.specifications ?? {},
    description: opts.input.description ?? '',
  });

  let structured;
  try {
    structured = await opts.provider.generateStructured({
      prompt,
      system: KEYWORD_OPTIMIZER_SYSTEM,
      model: routed.model,
      schemaName: 'KeywordOptimizeOutput',
      jsonSchema: KEYWORD_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: opts.config.temperature,
    });
  } catch {
    throw new AiUnavailableError();
  }

  let parsed = KeywordOptimizeOutputSchema.safeParse(
    coerceKeywordOutput(structured.data, currentKeywords),
  );
  if (!parsed.success) {
    try {
      const repair = await opts.provider.generateText({
        system: 'Return valid JSON only.',
        model: routed.model,
        json: true,
        temperature: 0,
        prompt: `Fix JSON to match KeywordOptimizeOutput. Errors: ${parsed.error.message}\nJSON:\n${structured.raw}`,
      });
      parsed = KeywordOptimizeOutputSchema.safeParse(
        coerceKeywordOutput(parseJsonLoose(repair.text), currentKeywords),
      );
      structured = {
        ...structured,
        raw: repair.text,
        usage: {
          inputTokens: structured.usage.inputTokens + repair.usage.inputTokens,
          outputTokens: structured.usage.outputTokens + repair.usage.outputTokens,
        },
        repaired: true,
      };
    } catch {
      throw new AiUnavailableError();
    }
  }
  if (!parsed.success) {
    throw new AiUnavailableError();
  }

  const sanitized = sanitizeMicKeywords(parsed.data.micKeywords, {
    ...opts.input,
    productName,
    currentKeywords,
  });
  if (!sanitized.list.length) {
    throw new AiUnavailableError();
  }

  const result: KeywordOptimizeResult = {
    currentKeywords: parsed.data.currentKeywords.length ? parsed.data.currentKeywords : currentKeywords,
    problems: parsed.data.problems,
    primaryKeywords: parsed.data.primaryKeywords,
    secondaryKeywords: parsed.data.secondaryKeywords,
    buyerIntentKeywords: parsed.data.buyerIntentKeywords,
    applicationKeywords: parsed.data.applicationKeywords,
    micKeywords: sanitized.list,
    factGuard: {
      ok: sanitized.warnings.length === 0,
      warnings: sanitized.warnings,
      removed: [],
    },
    meta: {
      taskType: 'KEYWORD_OPTIMIZATION',
      provider: opts.provider.name,
      model: structured.model || routed.model,
      latency: Date.now() - started,
      inputTokens: structured.usage.inputTokens,
      outputTokens: structured.usage.outputTokens,
      status: opts.provider.name === 'mock' ? 'fallback' : 'ok',
      promptVersion: KEYWORD_OPTIMIZER_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
  };

  setCached(key, result);
  return result;
}
