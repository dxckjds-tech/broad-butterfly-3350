import {
  TITLE_OPTIMIZER_PROMPT_VERSION,
  TITLE_OPTIMIZER_SYSTEM,
  buildTitleOptimizerUserPrompt,
} from '@trade-ai/prompts';
import { inspectProductIdentityWithGate, listingToPage } from '@trade-ai/scoring-rules';
import type {
  ProductIdentityConflict,
  ProductTruthProfile,
  RecommendedTitle,
  TitleOptimizePayload,
} from '@trade-ai/shared-types';
import {
  guardGeneratedTitle,
  reasonAboutProduct,
  resolveTrustedIdentity,
  titleRecommendationsPaused as computeTitlePaused,
  toProductTruthProfile,
  verifiedFactsForTitle,
  withTrustedCore,
} from '@trade-ai/universal-product-intelligence';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { applyFactGuard, type KnownFacts } from '../fact-guard';
import { routeModel } from '../model-router';
import { AI_ENGINE_VERSION, AI_UNAVAILABLE_MESSAGE, ENABLED_AI_TASKS } from '../provider';
import type { LLMProvider } from '../provider';
import {
  TITLE_JSON_SCHEMA,
  TitleOptimizeOutputSchema,
  coerceTitleStyles,
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
  companyName?: string;
  identityUserVerified?: boolean;
}

export type TitleOptimizeResult = TitleOptimizePayload;

function specByName(specs: Record<string, string>, pattern: RegExp): string {
  const entry = Object.entries(specs).find(([key]) => pattern.test(key));
  return entry?.[1]?.trim() ?? '';
}

function structuredTitleFacts(opts: {
  trustedIdentity: string;
  category: string;
  specifications: Record<string, string>;
  certifications: string[];
}): KnownFacts {
  return {
    productName: opts.trustedIdentity,
    category: opts.category,
    specifications: opts.specifications,
    certifications: opts.certifications,
  };
}

function buildSafeTitles(
  trustedIdentity: string,
  specifications: Record<string, string>,
  verifiedCerts: string[],
): RecommendedTitle[] {
  const model = specByName(specifications, /^(model|型号|item no|sku)$/i);
  const capacity = specByName(specifications, /capacity|tank|volume|容量/i);
  const power = specByName(specifications, /^(power|watt|功率)$/i);
  const application = specByName(specifications, /application|used for|scene|industry/i);
  const seoParts = [capacity, trustedIdentity, power, model].filter(Boolean);
  const buyerParts = [trustedIdentity, application ? `for ${application}` : '', model].filter(Boolean);
  const geoParts = [trustedIdentity, model].filter(Boolean);
  const used = [trustedIdentity, capacity, power, model, application, ...verifiedCerts].filter(Boolean);
  return [
    {
      style: 'SEO_BALANCED',
      title: seoParts.join(' ').slice(0, 120),
      reason: 'Lead with the trusted identity and VERIFIED specification tokens only.',
      usedFacts: used,
      warnings: ['Generated from VERIFIED structured facts after identity/claim guard.'],
    },
    {
      style: 'BUYER_INTENT',
      title: buyerParts.join(' ').slice(0, 120),
      reason: 'Keep the trusted product noun; add application only when a specification field verifies it.',
      usedFacts: used,
      warnings: ['Generated from VERIFIED structured facts after identity/claim guard.'],
    },
    {
      style: 'GEO_FRIENDLY',
      title: geoParts.join(' ').slice(0, 120),
      reason: 'Short entity-clear title using the trusted identity.',
      usedFacts: used,
      warnings: ['Generated from VERIFIED structured facts after identity/claim guard.'],
    },
  ];
}

function pausedResult(opts: {
  originalTitle: string;
  trustedIdentity: string;
  conflict: ProductIdentityConflict | null;
  profile: ProductTruthProfile;
  provider: string;
  latency: number;
}): TitleOptimizeResult {
  const summary =
    opts.conflict?.summary ||
    'PRODUCT_IDENTITY_CONFLICT：标题与类目/商品分组不是同一产品，已暂停标题生成。';
  return {
    originalTitle: opts.originalTitle,
    coreProductTerm: opts.trustedIdentity,
    trustedIdentity: opts.trustedIdentity,
    problems: [summary, '请先人工确认产品身份。确认前不得生成正式标题，且不会改写 MIC。'],
    recommendedTitles: [],
    keywordSuggestions: [],
    identityConflict: opts.conflict,
    productTruthProfile: opts.profile,
    titleRecommendationsPaused: true,
    factGuard: { ok: true, warnings: [summary], removed: [] },
    meta: {
      taskType: 'TITLE_OPTIMIZATION',
      provider: opts.provider,
      model: 'none',
      latency: opts.latency,
      inputTokens: 0,
      outputTokens: 0,
      status: 'fallback',
      promptVersion: TITLE_OPTIMIZER_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
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

  const userVerified = Boolean(opts.input.identityUserVerified);
  const page = listingToPage({ ...opts.input, productName, identityUserVerified: userVerified });
  const inspect = inspectProductIdentityWithGate(page);
  const reasoning = await reasonAboutProduct(page);
  const trustedIdentity = resolveTrustedIdentity(page, reasoning);
  const paused = computeTitlePaused(page, reasoning, inspect.keywordRecommendationsPaused);
  const verified = verifiedFactsForTitle(reasoning.productProfile, page);
  const truthProfile = withTrustedCore(toProductTruthProfile(reasoning, page), trustedIdentity);
  const conflict: ProductIdentityConflict | null = inspect.conflict
    ? {
        ...inspect.conflict,
        keywordRecommendationsPaused: paused,
      }
    : reasoning.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH')
      ? {
          code: 'PRODUCT_IDENTITY_CONFLICT',
          hasConflict: true,
          titleProduct: productName,
          categoryProduct: page.category,
          keywordProducts: page.keywords ?? [],
          specProduct: identitySpecFrom(page.specifications ?? {}),
          descriptionProduct: '',
          summary: reasoning.conflicts.find((c) => c.code === 'IDENTITY_MISMATCH')?.summary || 'Identity mismatch.',
          keywordRecommendationsPaused: paused,
        }
      : null;

  const key = cacheKey([
    'TITLE_OPTIMIZATION',
    opts.input.url,
    productName,
    userVerified ? 'verified' : 'unverified',
    trustedIdentity,
  ]);
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
  if (paused) {
    const result = pausedResult({
      originalTitle: productName,
      trustedIdentity,
      conflict,
      profile: truthProfile,
      provider: opts.provider.name,
      latency: Date.now() - started,
    });
    setCached(key, result);
    return result;
  }

  const routed = routeModel('TITLE_OPTIMIZATION', opts.config);
  const prompt = buildTitleOptimizerUserPrompt({
    trustedIdentity,
    staleSellerTitle: productName,
    category: opts.input.category ?? '',
    specifications: verified.specifications,
    verifiedCertifications: verified.certifications,
    verifiedMaterials: verified.materials,
    verifiedApplications: verified.applications,
    verifiedAttributes: verified.attributes,
  });

  const facts = structuredTitleFacts({
    trustedIdentity,
    category: opts.input.category ?? '',
    specifications: verified.specifications,
    certifications: verified.certifications,
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

  const removed: Array<{ key: string; value: string }> = [];
  const guardWarnings: string[] = [];
  const guarded: RecommendedTitle[] = [];

  for (const row of parsed.data.recommendedTitles) {
    const identity = guardGeneratedTitle(row.title, trustedIdentity, reasoning.productProfile);
    if (identity.identityFailed || !identity.cleaned) {
      guardWarnings.push(...identity.warnings);
      continue;
    }
    const fact = applyFactGuard(identity.cleaned, facts, { structuredOnly: true });
    if (!fact.cleaned) {
      guardWarnings.push(...fact.warnings, ...identity.warnings);
      removed.push(...fact.removed);
      continue;
    }
    const second = guardGeneratedTitle(fact.cleaned, trustedIdentity, reasoning.productProfile);
    if (second.identityFailed || !second.cleaned) {
      guardWarnings.push(...second.warnings, ...fact.warnings);
      removed.push(...fact.removed);
      continue;
    }
    removed.push(...fact.removed);
    guarded.push({
      ...row,
      title: second.cleaned,
      warnings: [...row.warnings, ...identity.warnings, ...fact.warnings, ...second.warnings],
      usedFacts: row.usedFacts.length ? row.usedFacts : [trustedIdentity],
    });
  }

  const recommendedTitles =
    guarded.length === 3
      ? guarded
      : buildSafeTitles(trustedIdentity, verified.specifications, verified.certifications).map((row) => {
          const g = guardGeneratedTitle(row.title, trustedIdentity, reasoning.productProfile);
          const fact = applyFactGuard(g.cleaned || row.title, facts, { structuredOnly: true });
          return {
            ...row,
            title: (g.cleaned || fact.cleaned || row.title).slice(0, 120),
            warnings: [...row.warnings, ...g.warnings, ...fact.warnings],
          };
        });

  const keywordSuggestions = parsed.data.keywordSuggestions
    .map((phrase) => {
      const g = guardGeneratedTitle(phrase, trustedIdentity, reasoning.productProfile);
      if (!g.cleaned) return '';
      const fact = applyFactGuard(g.cleaned, facts, { structuredOnly: true });
      return fact.cleaned;
    })
    .filter(Boolean)
    .slice(0, 3);

  const result: TitleOptimizeResult = {
    originalTitle: parsed.data.originalTitle || productName,
    coreProductTerm: trustedIdentity,
    trustedIdentity,
    problems: [
      ...parsed.data.problems,
      ...(paused ? [] : []),
      ...guardWarnings.filter((w) => w.startsWith('TITLE_IDENTITY_GUARD') || w.startsWith('TITLE_CLAIM_GUARD')),
    ].slice(0, 12),
    recommendedTitles,
    keywordSuggestions,
    identityConflict: conflict,
    productTruthProfile: truthProfile,
    titleRecommendationsPaused: false,
    factGuard: {
      ok: removed.length === 0 && guardWarnings.length === 0,
      warnings: [...guardWarnings, ...recommendedTitles.flatMap((t) => t.warnings.filter((w) => w.startsWith('FactGuard:')))],
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

function identitySpecFrom(specs: Record<string, string>): string {
  return specByName(specs, /^(type|product type|item name|product name|name)$/i);
}
