import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { loadAiConfig } from '../config';
import { routeModel } from '../model-router';
import { applyFactGuard } from '../fact-guard';
import { createLlmProvider } from '../factory';
import { optimizeTitle } from '../tasks/optimize-title';
import { optimizeKeywords } from '../tasks/optimize-keywords';
import { checkCategory } from '../tasks/check-category';
import { TitleOptimizeOutputSchema, coerceTitleStyles } from '../schemas/title';
import { isBannedHotTerm, isCenterTermRepeat } from '../schemas/keyword';
import { CategoryCheckOutputSchema, coerceCategoryOutput, looksLikeMicTaxonomyId } from '../schemas/category';
import { clearAiCache } from '../cache';
import { DeepSeekProvider } from '../providers/deepseek.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { MockLLMProvider } from '../providers/mock.provider';

const SAMPLE = {
  productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  category: 'Steam Cleaner',
  keywords: ['wet and dry vacuum cleaner', 'industrial vacuum'],
  centerTerms: ['vacuum cleaner'],
  specifications: { Voltage: '220V', Capacity: '60L' },
  description: 'Industrial wet and dry vacuum cleaner with high suction for workshop cleaning.',
  certifications: [] as string[],
  url: 'https://membercenter.made-in-china.com/product/demo-edit',
};

describe('AI config + router', () => {
  it('defaults to deepseek and falls back to mock without key', () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: '' });
    expect(cfg.requestedProvider).toBe('deepseek');
    expect(cfg.provider).toBe('mock');
    expect(cfg.fallbackReason).toMatch(/DEEPSEEK_API_KEY/);
    expect(createLlmProvider(cfg)).toBeInstanceOf(MockLLMProvider);
  });

  it('keeps OpenAIProvider available but not default', () => {
    const deep = loadAiConfig({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-test' });
    expect(createLlmProvider(deep)).toBeInstanceOf(DeepSeekProvider);
    const openai = loadAiConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' });
    expect(createLlmProvider(openai)).toBeInstanceOf(OpenAIProvider);
  });

  it('routes title to flash and category to pro', () => {
    const cfg = loadAiConfig({
      LLM_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'sk-test',
      DEEPSEEK_FAST_MODEL: 'deepseek-v4-flash',
      DEEPSEEK_PRO_MODEL: 'deepseek-v4-pro',
    });
    expect(routeModel('TITLE_OPTIMIZATION', cfg).model).toBe('deepseek-v4-flash');
    expect(routeModel('KEYWORD_OPTIMIZATION', cfg).model).toBe('deepseek-v4-flash');
    expect(routeModel('CATEGORY_CHECK', cfg).model).toBe('deepseek-v4-pro');
    expect(routeModel('GEO_DEEP_ANALYSIS', cfg).model).toBe('deepseek-v4-pro');
  });
});

describe('FactGuard', () => {
  it('strips invented ISO certification from titles', () => {
    const r = applyFactGuard('ISO 9001 Industrial Vacuum Cleaner', {
      productName: SAMPLE.productName,
      description: SAMPLE.description,
      certifications: [],
    });
    expect(r.ok).toBe(false);
    expect(r.removed.some((x) => x.key === 'certification')).toBe(true);
    expect(r.cleaned.toLowerCase()).not.toContain('iso 9001');
  });

  it('allows certification present on the page', () => {
    const r = applyFactGuard('CE Industrial Vacuum Cleaner', {
      productName: SAMPLE.productName,
      certifications: ['CE'],
    });
    expect(r.ok).toBe(true);
  });
});

describe('Zod title schema', () => {
  it('rejects incomplete JSON', () => {
    const parsed = TitleOptimizeOutputSchema.safeParse({ originalTitle: 'x' });
    expect(parsed.success).toBe(false);
  });

  it('coerces missing styles', () => {
    const coerced = coerceTitleStyles({
      originalTitle: SAMPLE.productName,
      coreProductTerm: 'vacuum cleaner',
      problems: ['long'],
      recommendedTitles: [
        { title: 'A vacuum cleaner', reason: 'seo balanced title here' },
        { title: 'B vacuum cleaner', reason: 'buyer intent title here' },
        { title: 'C vacuum cleaner', reason: 'geo friendly title here' },
      ],
    });
    const parsed = TitleOptimizeOutputSchema.parse(coerced);
    expect(parsed.recommendedTitles[0]?.style).toBe('SEO_BALANCED');
  });
});

describe('optimizeTitle mock path', () => {
  beforeEach(() => clearAiCache());

  it('returns 3 titles without calling network', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'deepseek' });
    const provider = createLlmProvider(cfg);
    const out = await optimizeTitle({ provider, config: cfg, input: SAMPLE });
    expect(out.originalTitle).toContain('Vacuum Cleaner');
    expect(out.recommendedTitles).toHaveLength(3);
    expect(out.keywordSuggestions.length).toBeGreaterThan(0);
    expect(out.meta.provider).toBe('mock');
    expect(out.meta.taskType).toBe('TITLE_OPTIMIZATION');
  });

  it('caches second call on the same page', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'mock' });
    const provider = createLlmProvider(cfg);
    const spy = vi.spyOn(provider, 'generateStructured');
    await optimizeTitle({ provider, config: cfg, input: SAMPLE });
    const second = await optimizeTitle({ provider, config: cfg, input: SAMPLE });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.meta.cached).toBe(true);
  });
});

describe('optimizeKeywords mock path', () => {
  beforeEach(() => clearAiCache());

  it('returns at most 10 MIC keywords with first 3 HIGH', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'deepseek' });
    const provider = createLlmProvider(cfg);
    const out = await optimizeKeywords({
      provider,
      config: cfg,
      input: { ...SAMPLE, currentKeywords: SAMPLE.keywords, centerTerms: ['cleaner', 'suction'] },
    });
    expect(out.micKeywords.length).toBeGreaterThan(0);
    expect(out.micKeywords.length).toBeLessThanOrEqual(10);
    expect(out.micKeywords.slice(0, 3).every((k) => k.priority === 'HIGH')).toBe(true);
    expect(out.primaryKeywords.length).toBeGreaterThan(0);
    expect(out.meta.taskType).toBe('KEYWORD_OPTIMIZATION');
    expect(out.micKeywords.some((k) => k.keyword.toLowerCase() === 'cleaner')).toBe(false);
  });

  it('caches the second keyword call on the same page', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'mock' });
    const provider = createLlmProvider(cfg);
    const spy = vi.spyOn(provider, 'generateStructured');
    const input = { ...SAMPLE, currentKeywords: SAMPLE.keywords };
    await optimizeKeywords({ provider, config: cfg, input });
    const second = await optimizeKeywords({ provider, config: cfg, input });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.meta.cached).toBe(true);
  });
});

describe('keyword sanitizer helpers', () => {
  it('flags center-term repeats and banned hot terms', () => {
    expect(isCenterTermRepeat('cleaner', ['cleaner', 'suction'])).toBe(true);
    expect(isCenterTermRepeat('wet dry vacuum cleaner', ['cleaner'])).toBe(false);
    expect(isBannedHotTerm('cheap wholesale', '')).toBe(true);
    expect(isBannedHotTerm('industrial vacuum', '')).toBe(false);
  });
});

describe('category schema coerce', () => {
  it('normalizes percent confidence and taxonomy-looking IDs', () => {
    const coerced = coerceCategoryOutput(
      {
        verdict: 'possible mismatch',
        confidence: 86,
        reason: '标题和关键词更接近 Wet and Dry Vacuum Cleaner，而不是 Steam Cleaner。',
        suggestedCategoryConcept: '100200300',
      },
      'Steam Cleaner',
    );
    const parsed = CategoryCheckOutputSchema.parse(coerced);
    expect(parsed.verdict).toBe('POSSIBLE_MISMATCH');
    expect(parsed.confidence).toBeCloseTo(0.86);
    expect(parsed.suggestedCategoryConcept).toBe('Steam Cleaner');
    expect(looksLikeMicTaxonomyId('100200300')).toBe(true);
    expect(looksLikeMicTaxonomyId('Wet and Dry Vacuum Cleaner')).toBe(false);
  });
});

describe('checkCategory mock path', () => {
  beforeEach(() => clearAiCache());

  it('flags vacuum vs Steam Cleaner as possible mismatch', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'deepseek' });
    const provider = createLlmProvider(cfg);
    const out = await checkCategory({ provider, config: cfg, input: SAMPLE });
    expect(out.verdict).toBe('POSSIBLE_MISMATCH');
    expect(out.currentCategory).toBe('Steam Cleaner');
    expect(out.suggestedCategoryConcept.toLowerCase()).toMatch(/vacuum/);
    expect(out.reason).toMatch(/Wet and Dry Vacuum Cleaner/);
    expect(out.reason).toMatch(/Steam Cleaner/);
    expect(out.confidence).toBeGreaterThan(0.5);
    expect(out.meta.taskType).toBe('CATEGORY_CHECK');
    expect(out.meta.provider).toBe('mock');
  });

  it('returns UNCERTAIN without calling the LLM when category is empty', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'mock' });
    const provider = createLlmProvider(cfg);
    const spy = vi.spyOn(provider, 'generateStructured');
    const out = await checkCategory({
      provider,
      config: cfg,
      input: { ...SAMPLE, category: '', url: 'https://membercenter.made-in-china.com/product/empty-cat' },
    });
    expect(out.verdict).toBe('UNCERTAIN');
    expect(spy).not.toHaveBeenCalled();
    expect(out.meta.model).toBe('none');
  });

  it('caches the second category call on the same page', async () => {
    const cfg = loadAiConfig({ LLM_PROVIDER: 'mock' });
    const provider = createLlmProvider(cfg);
    const spy = vi.spyOn(provider, 'generateStructured');
    await checkCategory({ provider, config: cfg, input: SAMPLE });
    const second = await checkCategory({ provider, config: cfg, input: SAMPLE });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.meta.cached).toBe(true);
  });
});

describe('DeepSeek HTTP client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts chat completions without leaking the api key in the result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toMatch(/^Bearer sk-live/);
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              model: 'deepseek-v4-flash',
              usage: { prompt_tokens: 11, completion_tokens: 7 },
              choices: [{ message: { content: 'OK' } }],
            }),
        };
      }),
    );
    const cfg = loadAiConfig({
      LLM_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'sk-live-not-for-git',
      DEEPSEEK_FAST_MODEL: 'deepseek-v4-flash',
    });
    const provider = new DeepSeekProvider(cfg);
    const out = await provider.generateText({ prompt: 'ping' });
    expect(out.text).toBe('OK');
    expect(out.model).toBe('deepseek-v4-flash');
    expect(JSON.stringify(out)).not.toContain('sk-live-not-for-git');
  });
});
