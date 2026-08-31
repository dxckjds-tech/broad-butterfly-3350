import {
  GEO_ANALYSIS_PROMPT_VERSION,
  GEO_ANALYSIS_SYSTEM,
  buildGeoAnalysisUserPrompt,
} from '@trade-ai/prompts';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { applyFactGuard } from '../fact-guard';
import type { KnownFacts } from '../fact-guard';
import { parseJsonLoose } from '../json';
import { routeModel } from '../model-router';
import { AI_ENGINE_VERSION, ENABLED_AI_TASKS } from '../provider';
import type { LLMProvider } from '../provider';
import {
  GEO_JSON_SCHEMA,
  GeoAnalysisOutputSchema,
  MISSING_FACT_ANSWER,
  coerceGeoOutput,
  type GeoAnalysisOutput,
} from '../schemas/geo';
import { AiUnavailableError } from './optimize-title';

export interface GeoAnalyzeInput {
  productName: string;
  companyName?: string;
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

export interface GeoAnalyzeResult {
  productEntity: string;
  companyEntity: string;
  verdict: GeoAnalysisOutput['verdict'];
  score: number;
  summary: string;
  gaps: GeoAnalysisOutput['gaps'];
  recommendations: GeoAnalysisOutput['recommendations'];
  faqSuggestions: GeoAnalysisOutput['faqSuggestions'];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: 'GEO_DEEP_ANALYSIS';
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

function listingFacts(input: {
  productName: string;
  companyName: string;
  category: string;
  keywords: string[];
  centerTerms: string[];
  specifications: Record<string, string>;
  description: string;
  certifications: string[];
  moq: string;
  deliveryTime: string;
}): KnownFacts & { companyName?: string } {
  return {
    productName: input.productName,
    category: input.category,
    keywords: input.keywords,
    centerTerms: input.centerTerms,
    specifications: input.specifications,
    description: input.description,
    certifications: input.certifications,
    moq: input.moq,
    deliveryTime: input.deliveryTime,
    companyName: input.companyName,
  };
}

function guardText(
  text: string,
  facts: KnownFacts,
  warnings: string[],
  removed: Array<{ key: string; value: string }>,
  fallback: string,
): string {
  const g = applyFactGuard(text, facts);
  warnings.push(...g.warnings);
  removed.push(...g.removed);
  const cleaned = (g.cleaned || '').trim();
  if (!cleaned) return fallback;
  return cleaned;
}

export async function analyzeGeo(opts: {
  provider: LLMProvider;
  config: AiRuntimeConfig;
  input: GeoAnalyzeInput;
  skipCache?: boolean;
}): Promise<GeoAnalyzeResult> {
  if (!ENABLED_AI_TASKS.has('GEO_DEEP_ANALYSIS')) {
    throw new AiUnavailableError();
  }

  const productName = opts.input.productName.trim();
  if (!productName) {
    throw new AiUnavailableError('产品标题为空，无法做 GEO 分析。');
  }

  const companyName = (opts.input.companyName ?? '').trim();
  const key = cacheKey(['GEO_DEEP_ANALYSIS', opts.input.url, productName, companyName]);
  if (!opts.skipCache) {
    const hit = getCached<GeoAnalyzeResult>(key);
    if (hit) return { ...hit, meta: { ...hit.meta, cached: true, status: 'cached' } };
  }

  const started = Date.now();
  const routed = routeModel('GEO_DEEP_ANALYSIS', opts.config);
  const keywords = opts.input.currentKeywords ?? opts.input.keywords ?? [];
  const specifications = opts.input.specifications ?? {};
  const description = (opts.input.description ?? '').trim();
  const certifications = opts.input.certifications ?? [];
  const coerceCtx = {
    productName,
    companyName,
    specifications,
    description,
    certifications,
    moq: opts.input.moq ?? '',
    deliveryTime: opts.input.deliveryTime ?? '',
  };
  const prompt = buildGeoAnalysisUserPrompt({
    productName,
    companyName,
    category: opts.input.category ?? '',
    keywords,
    centerTerms: opts.input.centerTerms ?? [],
    specifications,
    description,
    certifications,
    moq: opts.input.moq ?? '',
    deliveryTime: opts.input.deliveryTime ?? '',
  });

  let structured;
  try {
    structured = await opts.provider.generateStructured({
      prompt,
      system: GEO_ANALYSIS_SYSTEM,
      model: routed.model,
      schemaName: 'GeoAnalysisOutput',
      jsonSchema: GEO_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: opts.config.temperature,
    });
  } catch {
    throw new AiUnavailableError();
  }

  let parsed = GeoAnalysisOutputSchema.safeParse(coerceGeoOutput(structured.data, coerceCtx));
  if (!parsed.success) {
    try {
      const repair = await opts.provider.generateText({
        system: 'Return valid JSON only.',
        model: routed.model,
        json: true,
        temperature: 0,
        prompt: `Fix JSON to match GeoAnalysisOutput. Errors: ${parsed.error.message}\nJSON:\n${structured.raw}`,
      });
      parsed = GeoAnalysisOutputSchema.safeParse(
        coerceGeoOutput(parseJsonLoose(repair.text), coerceCtx),
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

  const facts = listingFacts({
    productName,
    companyName,
    category: opts.input.category ?? '',
    keywords,
    centerTerms: opts.input.centerTerms ?? [],
    specifications,
    description,
    certifications,
    moq: opts.input.moq ?? '',
    deliveryTime: opts.input.deliveryTime ?? '',
  });

  const warnings: string[] = [];
  const removed: Array<{ key: string; value: string }> = [];

  const summary = guardText(parsed.data.summary, facts, warnings, removed, parsed.data.summary);
  const recommendations = parsed.data.recommendations.map((row) => ({
    title: row.title,
    body: guardText(row.body, facts, warnings, removed, row.body),
  }));
  const faqSuggestions = parsed.data.faqSuggestions.map((row) => ({
    question: row.question,
    answer: guardText(row.answer, facts, warnings, removed, MISSING_FACT_ANSWER),
  }));

  const result: GeoAnalyzeResult = {
    productEntity: parsed.data.productEntity || productName,
    companyEntity: parsed.data.companyEntity || companyName,
    verdict: parsed.data.verdict,
    score: parsed.data.score,
    summary,
    gaps: parsed.data.gaps,
    recommendations,
    faqSuggestions,
    factGuard: {
      ok: warnings.length === 0,
      warnings,
      removed,
    },
    meta: {
      taskType: 'GEO_DEEP_ANALYSIS',
      provider: opts.provider.name,
      model: structured.model || routed.model,
      latency: Date.now() - started,
      inputTokens: structured.usage.inputTokens,
      outputTokens: structured.usage.outputTokens,
      status: opts.provider.name === 'mock' ? 'fallback' : 'ok',
      promptVersion: GEO_ANALYSIS_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
  };

  setCached(key, result);
  return result;
}
