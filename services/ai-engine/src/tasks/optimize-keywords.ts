import {
  KEYWORD_OPTIMIZER_PROMPT_VERSION,
  KEYWORD_OPTIMIZER_SYSTEM,
  buildKeywordOptimizerUserPrompt,
} from '@trade-ai/prompts';
import {
  gateKeywordList,
  inspectProductIdentityWithGate,
  listingToPage,
} from '@trade-ai/scoring-rules';
import type {
  BlockedKeyword,
  GatedKeyword,
  KeywordOptimizePayload,
  KeywordSuggestion,
  MicKeywordSuggestion,
  ProductIdentityConflict,
  ProductTruthProfile,
} from '@trade-ai/shared-types';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { applyFactGuard, type KnownFacts } from '../fact-guard';
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
  companyName?: string;
  identityUserVerified?: boolean;
}

export type KeywordOptimizeResult = KeywordOptimizePayload;

const REJECT_STATUSES = new Set(['REJECTED', 'REJECTED_PRODUCT_MISMATCH']);

function factsFromInput(input: KeywordOptimizeInput, productName: string): KnownFacts {
  return {
    productName,
    companyName: input.companyName,
    category: input.category,
    keywords: input.currentKeywords ?? input.keywords,
    centerTerms: input.centerTerms,
    specifications: input.specifications,
    description: input.description,
    certifications: input.certifications,
    moq: input.moq,
    deliveryTime: input.deliveryTime,
  };
}

function knownCorpus(input: KeywordOptimizeInput, productName: string): string {
  return [
    productName,
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

function emptySuggestions(): KeywordSuggestion[] {
  return [];
}

function pausedResult(opts: {
  currentKeywords: string[];
  conflict: ProductIdentityConflict | null;
  profile: ProductTruthProfile;
  gated: GatedKeyword[];
  blocked: BlockedKeyword[];
  provider: string;
  latency: number;
}): KeywordOptimizeResult {
  const summary =
    opts.conflict?.summary ||
    'PRODUCT_IDENTITY_CONFLICT：标题与类目/关键词不是同一产品，已暂停关键词推荐。';
  return {
    currentKeywords: opts.currentKeywords,
    problems: [summary, '请先人工确认产品身份。确认前不得生成正式关键词推荐，且不会改写 MIC。'],
    primaryKeywords: emptySuggestions(),
    secondaryKeywords: emptySuggestions(),
    buyerIntentKeywords: emptySuggestions(),
    applicationKeywords: emptySuggestions(),
    micKeywords: [],
    officialTop3: [],
    gatedKeywords: opts.gated,
    blockedKeywords: opts.blocked,
    identityConflict: opts.conflict,
    productTruthProfile: opts.profile,
    keywordRecommendationsPaused: true,
    searchDemand: 'UNKNOWN',
    factGuard: { ok: true, warnings: [summary], removed: [] },
    meta: {
      taskType: 'KEYWORD_OPTIMIZATION',
      provider: opts.provider,
      model: 'none',
      latency: opts.latency,
      inputTokens: 0,
      outputTokens: 0,
      status: 'fallback',
      promptVersion: KEYWORD_OPTIMIZER_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
  };
}

function mergeFactGuard(
  keyword: string,
  gated: GatedKeyword,
  facts: KnownFacts,
): { gated: GatedKeyword; blocked?: BlockedKeyword } {
  const guard = applyFactGuard(keyword, facts);
  if (guard.ok) return { gated };
  const reasons = [...new Set([...gated.blockedReasons, 'BLOCKED_BY_FACT_GUARD' as const])];
  const next: GatedKeyword = {
    ...gated,
    blockedReasons: reasons,
    officialTop3Eligible: false,
    status: REJECT_STATUSES.has(gated.status) ? gated.status : 'REJECTED',
  };
  return {
    gated: next,
    blocked: {
      keyword,
      reasons,
      note: guard.warnings.find((w) => w.startsWith('BLOCKED_BY_FACT_GUARD')) || guard.warnings[0] || 'BLOCKED_BY_FACT_GUARD',
      matchScore: next.matchScore,
    },
  };
}

function sanitizeMicKeywords(
  items: KeywordOptimizeOutput['micKeywords'],
  input: KeywordOptimizeInput,
  facts: KnownFacts,
): { list: MicKeywordSuggestion[]; warnings: string[]; removed: Array<{ key: string; value: string }> } {
  const center = input.centerTerms ?? [];
  const seen = new Set<string>();
  const warnings: string[] = [];
  const removed: Array<{ key: string; value: string }> = [];
  const list: MicKeywordSuggestion[] = [];

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
    if (isBannedHotTerm(keyword, knownCorpus(input, input.productName))) {
      warnings.push(`Dropped unrelated hot term "${keyword}"`);
      continue;
    }
    const guarded = applyFactGuard(keyword, facts);
    if (!guarded.ok) {
      warnings.push(...guarded.warnings);
      removed.push(...guarded.removed);
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

  return { list, warnings, removed };
}

function gateSuggestionList(
  items: KeywordSuggestion[],
  page: ReturnType<typeof listingToPage>,
  profile: ProductTruthProfile,
  facts: KnownFacts,
): { kept: KeywordSuggestion[]; blocked: BlockedKeyword[]; gated: GatedKeyword[]; severe: boolean } {
  const blocked: BlockedKeyword[] = [];
  const gated: GatedKeyword[] = [];
  const kept: KeywordSuggestion[] = [];
  let severe = false;
  for (const item of items) {
    const [row] = gateKeywordList([item.keyword], page, profile).gated;
    if (!row) continue;
    const merged = mergeFactGuard(item.keyword, row, facts);
    gated.push(merged.gated);
    if (merged.blocked) {
      blocked.push(merged.blocked);
      if (applyFactGuard(item.keyword, facts).severe) severe = true;
      continue;
    }
    if (REJECT_STATUSES.has(merged.gated.status) || merged.gated.blockedReasons.length) {
      if (merged.gated.blockedReasons.length) {
        blocked.push({
          keyword: item.keyword,
          reasons: merged.gated.blockedReasons,
          note: `门禁 ${merged.gated.status}，匹配分 ${merged.gated.matchScore}。`,
          matchScore: merged.gated.matchScore,
        });
      }
      continue;
    }
    kept.push(item);
  }
  return { kept, blocked, gated, severe };
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
  const userVerified = Boolean(opts.input.identityUserVerified);
  const page = listingToPage({ ...opts.input, productName, currentKeywords, identityUserVerified: userVerified });
  const inspect = inspectProductIdentityWithGate(page);
  const facts = factsFromInput(opts.input, productName);

  const key = cacheKey([
    'KEYWORD_OPTIMIZATION',
    opts.input.url,
    productName,
    currentKeywords.join(','),
    userVerified ? 'verified' : 'unverified',
  ]);
  if (!opts.skipCache) {
    const hit = getCached<KeywordOptimizeResult>(key);
    if (hit) {
      return { ...hit, meta: { ...hit.meta, cached: true, status: 'cached' } };
    }
  }

  const started = Date.now();

  if (inspect.keywordRecommendationsPaused) {
    const result = pausedResult({
      currentKeywords,
      conflict: inspect.conflict,
      profile: inspect.profile,
      gated: inspect.currentKeywordGate,
      blocked: inspect.blockedKeywords,
      provider: opts.provider.name,
      latency: Date.now() - started,
    });
    setCached(key, result);
    return result;
  }

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

  const sanitized = sanitizeMicKeywords(parsed.data.micKeywords, { ...opts.input, productName, currentKeywords }, facts);
  const currentGate = gateKeywordList(currentKeywords, page, inspect.profile);
  const candidateGate = gateKeywordList(
    sanitized.list.map((row) => row.keyword),
    page,
    inspect.profile,
  );
  const mergedGated: GatedKeyword[] = [];
  const mergedBlocked: BlockedKeyword[] = [...currentGate.blocked];
  let severe = false;

  for (const row of candidateGate.gated) {
    const merged = mergeFactGuard(row.keyword, row, facts);
    mergedGated.push(merged.gated);
    if (merged.blocked) {
      mergedBlocked.push(merged.blocked);
      if (applyFactGuard(row.keyword, facts).severe) severe = true;
    } else if (merged.gated.blockedReasons.length) {
      mergedBlocked.push({
        keyword: row.keyword,
        reasons: merged.gated.blockedReasons,
        note: `门禁 ${merged.gated.status}，匹配分 ${merged.gated.matchScore}。`,
        matchScore: merged.gated.matchScore,
      });
    }
  }

  const allowedMic: MicKeywordSuggestion[] = [];
  for (const row of sanitized.list) {
    const gated = mergedGated.find((g) => g.keyword.toLowerCase() === row.keyword.toLowerCase());
    if (!gated || REJECT_STATUSES.has(gated.status) || gated.blockedReasons.length) continue;
    allowedMic.push({
      ...row,
      matchScore: gated.matchScore,
      gateStatus: gated.status,
    });
  }

  const primary = gateSuggestionList(parsed.data.primaryKeywords, page, inspect.profile, facts);
  const secondary = gateSuggestionList(parsed.data.secondaryKeywords, page, inspect.profile, facts);
  const buyer = gateSuggestionList(parsed.data.buyerIntentKeywords, page, inspect.profile, facts);
  const application = gateSuggestionList(parsed.data.applicationKeywords, page, inspect.profile, facts);
  severe = severe || primary.severe || secondary.severe || buyer.severe || application.severe;

  const blockedByKey = new Map<string, BlockedKeyword>();
  for (const row of [
    ...mergedBlocked,
    ...primary.blocked,
    ...secondary.blocked,
    ...buyer.blocked,
    ...application.blocked,
  ]) {
    const k = row.keyword.toLowerCase();
    const prev = blockedByKey.get(k);
    if (!prev) blockedByKey.set(k, row);
    else blockedByKey.set(k, { ...prev, reasons: [...new Set([...prev.reasons, ...row.reasons])] });
  }

  const gatedByKey = new Map<string, GatedKeyword>();
  for (const row of [...currentGate.gated, ...mergedGated, ...primary.gated, ...secondary.gated, ...buyer.gated, ...application.gated]) {
    gatedByKey.set(row.keyword.toLowerCase(), row);
  }

  const factWarnings = [
    ...sanitized.warnings,
    ...(severe ? ['严重事实声明未验证，已禁止展示正式关键词推荐。'] : []),
  ];

  const result: KeywordOptimizeResult = {
    currentKeywords: parsed.data.currentKeywords.length ? parsed.data.currentKeywords : currentKeywords,
    problems: [
      ...parsed.data.problems,
      '无真实搜索数据，demand=UNKNOWN，不能进入正式 Top3。',
    ],
    primaryKeywords: severe ? [] : primary.kept,
    secondaryKeywords: severe ? [] : secondary.kept,
    buyerIntentKeywords: severe ? [] : buyer.kept,
    applicationKeywords: severe ? [] : application.kept,
    micKeywords: severe ? [] : allowedMic,
    officialTop3: [],
    gatedKeywords: [...gatedByKey.values()],
    blockedKeywords: [...blockedByKey.values()],
    identityConflict: inspect.conflict,
    productTruthProfile: inspect.profile,
    keywordRecommendationsPaused: false,
    searchDemand: 'UNKNOWN',
    factGuard: {
      ok: sanitized.warnings.length === 0 && !severe,
      warnings: factWarnings,
      removed: sanitized.removed,
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
