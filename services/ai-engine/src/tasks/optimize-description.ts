import {
  DESCRIPTION_OPTIMIZER_PROMPT_VERSION,
  DESCRIPTION_OPTIMIZER_SYSTEM,
  buildDescriptionOptimizerUserPrompt,
} from '@trade-ai/prompts';
import { cacheKey, getCached, setCached } from '../cache';
import type { AiRuntimeConfig } from '../config';
import { applyFactGuard } from '../fact-guard';
import { parseJsonLoose } from '../json';
import { routeModel } from '../model-router';
import { AI_ENGINE_VERSION, ENABLED_AI_TASKS } from '../provider';
import type { LLMProvider } from '../provider';
import {
  DESCRIPTION_JSON_SCHEMA,
  DESCRIPTION_SECTION_TITLES,
  DescriptionOptimizeOutputSchema,
  assembleDescription,
  coerceDescriptionOutput,
  type DescriptionOptimizeOutput,
} from '../schemas/description';
import { AiUnavailableError } from './optimize-title';

const MARKETING_FLUFF =
  /\b(high quality|best quality|good quality|top quality|premium quality|factory price|competitive price|hot sale|wholesale|welcome to inquiry|excellent service|professional supplier)\b/gi;

export interface DescriptionOptimizeInput {
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

export interface DescriptionOptimizeResult {
  originalDescription: string;
  problems: string[];
  sections: DescriptionOptimizeOutput['sections'];
  recommendedDescription: string;
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: 'DESCRIPTION_OPTIMIZATION';
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

function stripMarketing(text: string): string {
  return text.replace(MARKETING_FLUFF, ' ').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function ensureRequiredSections(
  sections: DescriptionOptimizeOutput['sections'],
  input: {
    productName: string;
    description: string;
    specifications: Record<string, string>;
    keywords: string[];
  },
): DescriptionOptimizeOutput['sections'] {
  const byHeading = new Map(sections.map((s) => [s.heading, s]));
  const specLines = Object.entries(input.specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  if (!byHeading.has('OVERVIEW')) {
    const body =
      `${input.productName} is listed for industrial buyers. ` +
      (input.description
        ? `Current listing copy: ${input.description.slice(0, 280)}`
        : 'Use the product name and listed specifications as the overview.');
    byHeading.set('OVERVIEW', {
      heading: 'OVERVIEW',
      title: DESCRIPTION_SECTION_TITLES.OVERVIEW,
      body: body.slice(0, 1500),
    });
  }
  if (!byHeading.has('SPECIFICATIONS')) {
    const body = specLines
      ? `Key specifications from the listing:\n${specLines}`
      : `${input.productName} specifications should follow the values already filled on the form.`;
    byHeading.set('SPECIFICATIONS', {
      heading: 'SPECIFICATIONS',
      title: DESCRIPTION_SECTION_TITLES.SPECIFICATIONS,
      body: body.slice(0, 1500),
    });
  }
  if (!byHeading.has('APPLICATIONS')) {
    const hint = [...input.keywords, input.description, specLines].join(' ');
    const body = /workshop|industrial|application/i.test(hint)
      ? 'Suitable for industrial workshop cleaning where dust and liquid pickup is required, matching the listed application.'
      : `Typical use should follow the product type in the title: ${input.productName}.`;
    byHeading.set('APPLICATIONS', {
      heading: 'APPLICATIONS',
      title: DESCRIPTION_SECTION_TITLES.APPLICATIONS,
      body,
    });
  }
  const order = ['OVERVIEW', 'SPECIFICATIONS', 'APPLICATIONS', 'CUSTOMIZATION', 'PACKING'] as const;
  return order.map((h) => byHeading.get(h)).filter((s): s is NonNullable<typeof s> => Boolean(s)).slice(0, 5);
}

export async function optimizeDescription(opts: {
  provider: LLMProvider;
  config: AiRuntimeConfig;
  input: DescriptionOptimizeInput;
  skipCache?: boolean;
}): Promise<DescriptionOptimizeResult> {
  if (!ENABLED_AI_TASKS.has('DESCRIPTION_OPTIMIZATION')) {
    throw new AiUnavailableError();
  }

  const productName = opts.input.productName.trim();
  if (!productName) {
    throw new AiUnavailableError('产品标题为空，无法优化描述。');
  }

  const originalDescription = (opts.input.description ?? '').trim();
  const key = cacheKey(['DESCRIPTION_OPTIMIZATION', opts.input.url, productName, originalDescription.slice(0, 160)]);
  if (!opts.skipCache) {
    const hit = getCached<DescriptionOptimizeResult>(key);
    if (hit) return { ...hit, meta: { ...hit.meta, cached: true, status: 'cached' } };
  }

  const started = Date.now();
  const routed = routeModel('DESCRIPTION_OPTIMIZATION', opts.config);
  const keywords = opts.input.currentKeywords ?? opts.input.keywords ?? [];
  const specifications = opts.input.specifications ?? {};
  const prompt = buildDescriptionOptimizerUserPrompt({
    productName,
    category: opts.input.category ?? '',
    keywords,
    centerTerms: opts.input.centerTerms ?? [],
    specifications,
    description: originalDescription,
    certifications: opts.input.certifications ?? [],
    moq: opts.input.moq ?? '',
    deliveryTime: opts.input.deliveryTime ?? '',
  });

  let structured;
  try {
    structured = await opts.provider.generateStructured({
      prompt,
      system: DESCRIPTION_OPTIMIZER_SYSTEM,
      model: routed.model,
      schemaName: 'DescriptionOptimizeOutput',
      jsonSchema: DESCRIPTION_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: opts.config.temperature,
    });
  } catch {
    throw new AiUnavailableError();
  }

  let parsed = DescriptionOptimizeOutputSchema.safeParse(
    coerceDescriptionOutput(structured.data, originalDescription),
  );
  if (!parsed.success) {
    try {
      const repair = await opts.provider.generateText({
        system: 'Return valid JSON only.',
        model: routed.model,
        json: true,
        temperature: 0,
        prompt: `Fix JSON to match DescriptionOptimizeOutput. Errors: ${parsed.error.message}\nJSON:\n${structured.raw}`,
      });
      parsed = DescriptionOptimizeOutputSchema.safeParse(
        coerceDescriptionOutput(parseJsonLoose(repair.text), originalDescription),
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
    category: opts.input.category,
    keywords,
    centerTerms: opts.input.centerTerms,
    specifications,
    description: originalDescription,
    certifications: opts.input.certifications,
    moq: opts.input.moq,
    deliveryTime: opts.input.deliveryTime,
  };

  const warnings: string[] = [];
  const removed: Array<{ key: string; value: string }> = [];
  const guardedSections = ensureRequiredSections(parsed.data.sections, {
    productName,
    description: originalDescription,
    specifications,
    keywords,
  }).map((row) => {
    const fluff = stripMarketing(row.body);
    const g = applyFactGuard(fluff, facts);
    warnings.push(...g.warnings);
    removed.push(...g.removed);
    const body = (g.cleaned || fluff || row.body).trim();
    return {
      heading: row.heading,
      title: DESCRIPTION_SECTION_TITLES[row.heading],
      body: body.length >= 20 ? body : row.body,
    };
  });

  if (guardedSections.length < 3) {
    throw new AiUnavailableError();
  }

  const recommended = stripMarketing(
    assembleDescription(guardedSections) || parsed.data.recommendedDescription,
  );
  const recGuard = applyFactGuard(recommended, facts);
  warnings.push(...recGuard.warnings);
  removed.push(...recGuard.removed);

  const result: DescriptionOptimizeResult = {
    originalDescription: parsed.data.originalDescription || originalDescription,
    problems: parsed.data.problems,
    sections: guardedSections,
    recommendedDescription: recGuard.cleaned || recommended,
    factGuard: {
      ok: warnings.length === 0,
      warnings,
      removed,
    },
    meta: {
      taskType: 'DESCRIPTION_OPTIMIZATION',
      provider: opts.provider.name,
      model: structured.model || routed.model,
      latency: Date.now() - started,
      inputTokens: structured.usage.inputTokens,
      outputTokens: structured.usage.outputTokens,
      status: opts.provider.name === 'mock' ? 'fallback' : 'ok',
      promptVersion: DESCRIPTION_OPTIMIZER_PROMPT_VERSION,
      cached: false,
      engineVersion: AI_ENGINE_VERSION,
    },
  };

  setCached(key, result);
  return result;
}
