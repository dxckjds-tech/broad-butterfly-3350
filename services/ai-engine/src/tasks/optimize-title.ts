import {
  TITLE_OPTIMIZER_PROMPT_VERSION,
  TITLE_OPTIMIZER_SYSTEM,
  buildTitleOptimizerUserPrompt,
} from '@trade-ai/prompts';
import { detectCoreProductTerm } from '@trade-ai/scoring-rules';
import { emptyPageData } from '@trade-ai/shared-types';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { AI_ENGINE_VERSION, AI_UNAVAILABLE_MESSAGE, ENABLED_AI_TASKS } from '../provider';
import { applyFactGuard } from '../fact-guard';
import { routeModel } from '../model-router';
import type { LLMProvider } from '../provider';
import {
  TITLE_JSON_SCHEMA,
  TitleOptimizeOutputSchema,
  coerceTitleStyles,
  type TitleOptimizeOutput,
} from '../schemas/title';

export class AiUnavailableError extends Error {
  readonly code = 'AI_UNAVAILABLE';
  constructor(message = AI_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface TitleOptimizeInput {
  productName: string;
  category?: string;
  keywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  moq?: string;
  deliveryTime?: string;
}

export interface TitleOptimizeResult {
  originalTitle: string;
  coreProductTerm: string;
  problems: string[];
  recommendedTitles: TitleOptimizeOutput['recommendedTitles'];
  keywordSuggestions: string[];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: 'TITLE_OPTIMIZATION';
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

export async function optimizeTitle(opts: {
  provider: LLMProvider;
  config: AiRuntimeConfig;
  input: TitleOptimizeInput;
  skipCache?: boolean;
}): Promise<TitleOptimizeResult> {
  if (!ENABLED_AI_TASKS.has('TITLE_OPTIMIZATION')) {
    throw new AiUnavailableError();
  }

  const productName = opts.input.productName.trim();
  if (!productName) {
    throw new AiUnavailableError('产品标题为空，无法优化。');
  }

  const key = cacheKey(['TITLE_OPTIMIZATION', opts.input.url, productName]);
  if (!opts.skipCache) {
    const hit = getCached<TitleOptimizeResult>(key);
    if (hit) {
      return {
        ...hit,
        meta: { ...hit.meta, cached: true, status: 'cached' },
      };
    }
  }

  const started = Date.now();
  const routed = routeModel('TITLE_OPTIMIZATION', opts.config);
  const prompt = buildTitleOptimizerUserPrompt({
    productName,
    category: opts.input.category ?? '',
    keywords: opts.input.keywords ?? [],
    centerTerms: opts.input.centerTerms ?? [],
    specifications: opts.input.specifications ?? {},
    description: opts.input.description ?? '',
    certifications: opts.input.certifications ?? [],
  });

  let structured;
  try {
    structured = await opts.provider.generateStructured({
      prompt,
      system: TITLE_OPTIMIZER_SYSTEM,
      model: routed.model,
      schemaName: 'TitleOptimizeOutput',
      jsonSchema: TITLE_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: opts.config.temperature,
    });
  } catch {
    throw new AiUnavailableError();
  }

  let parsed = TitleOptimizeOutputSchema.safeParse(coerceTitleStyles(structured.data));
  if (!parsed.success) {
    try {
      const repair = await opts.provider.generateText({
        system: 'Return valid JSON only.',
        model: routed.model,
        json: true,
        temperature: 0,
        prompt: `Fix JSON to match TitleOptimizeOutput. Errors: ${parsed.error.message}\nJSON:\n${structured.raw}`,
      });
      const { parseJsonLoose } = await import('../json');
      parsed = TitleOptimizeOutputSchema.safeParse(coerceTitleStyles(parseJsonLoose(repair.text)));
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
    category: opts.input.category,
    keywords: opts.input.keywords,
    centerTerms: opts.input.centerTerms,
    specifications: opts.input.specifications,
    description: opts.input.description,
    certifications: opts.input.certifications,
    moq: opts.input.moq,
    deliveryTime: opts.input.deliveryTime,
  };

  const fallbackCore =
    detectCoreProductTerm(
      emptyPageData({
        productName,
        title: productName,
        platform: 'MADE_IN_CHINA',
        pageType: 'MIC_PRODUCT_EDIT',
        category: opts.input.category ?? '',
        keywords: opts.input.keywords ?? [],
      }),
    ).coreProductTerm || productName;

  const guardedTitles = parsed.data.recommendedTitles.map((row) => {
    const g = applyFactGuard(row.title, facts);
    return {
      ...row,
      title: g.cleaned || row.title,
      warnings: [...row.warnings, ...g.warnings],
      usedFacts: row.usedFacts,
      _removed: g.removed,
    };
  });

  const removed = guardedTitles.flatMap((t) => t._removed);
  const warnings = guardedTitles.flatMap((t) => t.warnings.filter((w) => w.startsWith('FactGuard:')));

  const result: TitleOptimizeResult = {
    originalTitle: parsed.data.originalTitle || productName,
    coreProductTerm: parsed.data.coreProductTerm || fallbackCore,
    problems: parsed.data.problems,
    recommendedTitles: guardedTitles.map(({ _removed: _, ...row }) => row),
    keywordSuggestions: parsed.data.keywordSuggestions.slice(0, 3),
    factGuard: {
      ok: removed.length === 0,
      warnings,
      removed,
    },
    meta: {
      taskType: 'TITLE_OPTIMIZATION',
      provider: opts.provider.name,
      model: structured.model || routed.model,
      latency: Date.now() - started,
      inputTokens: structured.usage.inputTokens,
      outputTokens: structured.usage.outputTokens,
      status: opts.provider.name === 'mock' ? 'fallback' : 'ok',
      promptVersion: TITLE_OPTIMIZER_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
  };

  setCached(key, result);
  return result;
}
