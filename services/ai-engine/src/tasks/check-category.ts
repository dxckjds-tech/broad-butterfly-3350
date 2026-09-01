import {
  CATEGORY_CHECK_PROMPT_VERSION,
  CATEGORY_CHECK_SYSTEM,
  buildCategoryCheckUserPrompt,
} from '@trade-ai/prompts';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { applyFactGuard } from '../fact-guard';
import { parseJsonLoose } from '../json';
import { routeModel } from '../model-router';
import { AI_ENGINE_VERSION, ENABLED_AI_TASKS } from '../provider';
import type { LLMProvider } from '../provider';
import {
  CATEGORY_JSON_SCHEMA,
  CategoryCheckOutputSchema,
  coerceCategoryOutput,
  looksLikeMicTaxonomyId,
} from '../schemas/category';
import { AiUnavailableError } from './optimize-title';

export interface CategoryCheckInput {
  productName: string;
  category?: string;
  keywords?: string[];
  currentKeywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  moq?: string;
  deliveryTime?: string;
}

export interface CategoryCheckResult {
  currentCategory: string;
  verdict: 'MATCH' | 'POSSIBLE_MISMATCH' | 'MISMATCH' | 'UNCERTAIN';
  confidence: number;
  reason: string;
  suggestedCategoryConcept: string;
  usedFacts: string[];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: 'CATEGORY_CHECK';
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

export async function checkCategory(opts: {
  provider: LLMProvider;
  config: AiRuntimeConfig;
  input: CategoryCheckInput;
  skipCache?: boolean;
}): Promise<CategoryCheckResult> {
  if (!ENABLED_AI_TASKS.has('CATEGORY_CHECK')) {
    throw new AiUnavailableError();
  }

  const productName = opts.input.productName.trim();
  const currentCategory = (opts.input.category ?? '').trim();
  if (!productName) {
    throw new AiUnavailableError('产品标题为空，无法判断类目。');
  }

  const key = cacheKey(['CATEGORY_CHECK', opts.input.url, productName, currentCategory]);
  if (!opts.skipCache) {
    const hit = getCached<CategoryCheckResult>(key);
    if (hit) return { ...hit, meta: { ...hit.meta, cached: true, status: 'cached' } };
  }

  if (!currentCategory) {
    const empty: CategoryCheckResult = {
      currentCategory: '（未识别类目）',
      verdict: 'UNCERTAIN',
      confidence: 0.2,
      reason: '当前页面没有可靠类目字段，AI 不能判断是否匹配。',
      suggestedCategoryConcept: productName,
      usedFacts: [productName],
      factGuard: { ok: true, warnings: [], removed: [] },
      meta: {
        taskType: 'CATEGORY_CHECK',
        provider: opts.provider.name,
        model: 'none',
        latency: 0,
        inputTokens: 0,
        outputTokens: 0,
        status: opts.provider.name === 'mock' ? 'fallback' : 'ok',
        promptVersion: CATEGORY_CHECK_PROMPT_VERSION,
        cached: false,
        engineVersion: AI_ENGINE_VERSION,
      },
    };
    setCached(key, empty);
    return empty;
  }

  const started = Date.now();
  const routed = routeModel('CATEGORY_CHECK', opts.config);
  const keywords = opts.input.currentKeywords ?? opts.input.keywords ?? [];
  const prompt = buildCategoryCheckUserPrompt({
    productName,
    category: currentCategory,
    keywords,
    centerTerms: opts.input.centerTerms ?? [],
    specifications: opts.input.specifications ?? {},
    description: opts.input.description ?? '',
  });

  let structured;
  try {
    structured = await opts.provider.generateStructured({
      prompt,
      system: CATEGORY_CHECK_SYSTEM,
      model: routed.model,
      schemaName: 'CategoryCheckOutput',
      jsonSchema: CATEGORY_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: opts.config.temperature,
    });
  } catch {
    throw new AiUnavailableError();
  }

  let parsed = CategoryCheckOutputSchema.safeParse(coerceCategoryOutput(structured.data, currentCategory));
  if (!parsed.success) {
    try {
      const repair = await opts.provider.generateText({
        system: 'Return valid JSON only.',
        model: routed.model,
        json: true,
        temperature: 0,
        prompt: `Fix JSON to match CategoryCheckOutput. Errors: ${parsed.error.message}\nJSON:\n${structured.raw}`,
      });
      parsed = CategoryCheckOutputSchema.safeParse(
        coerceCategoryOutput(parseJsonLoose(repair.text), currentCategory),
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

  const facts = {
    productName,
    category: currentCategory,
    keywords,
    centerTerms: opts.input.centerTerms,
    specifications: opts.input.specifications,
    description: opts.input.description,
    certifications: opts.input.certifications,
    moq: opts.input.moq,
    deliveryTime: opts.input.deliveryTime,
  };
  const reasonGuard = applyFactGuard(parsed.data.reason, facts);
  const conceptGuard = applyFactGuard(parsed.data.suggestedCategoryConcept, facts);
  const warnings = [...reasonGuard.warnings, ...conceptGuard.warnings];
  let suggested = (conceptGuard.cleaned || parsed.data.suggestedCategoryConcept).trim();
  if (!suggested || looksLikeMicTaxonomyId(suggested)) {
    suggested =
      parsed.data.verdict === 'MATCH' ? currentCategory : productName.slice(0, 160);
  }
  const usedFacts = (parsed.data.usedFacts ?? []).filter(Boolean).slice(0, 12);
  if (!usedFacts.length) {
    usedFacts.push(...[productName, currentCategory].filter(Boolean));
  }

  const result: CategoryCheckResult = {
    currentCategory: parsed.data.currentCategory || currentCategory,
    verdict: parsed.data.verdict,
    confidence: parsed.data.confidence,
    reason: reasonGuard.cleaned || parsed.data.reason,
    suggestedCategoryConcept: suggested,
    usedFacts,
    factGuard: {
      ok: warnings.length === 0,
      warnings,
      removed: [...reasonGuard.removed, ...conceptGuard.removed],
    },
    meta: {
      taskType: 'CATEGORY_CHECK',
      provider: opts.provider.name,
      model: structured.model || routed.model,
      latency: Date.now() - started,
      inputTokens: structured.usage.inputTokens,
      outputTokens: structured.usage.outputTokens,
      status: opts.provider.name === 'mock' ? 'fallback' : 'ok',
      promptVersion: CATEGORY_CHECK_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
  };

  setCached(key, result);
  return result;
}
