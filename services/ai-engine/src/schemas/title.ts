import { z } from 'zod';

export const TitleStyleSchema = z.enum(['SEO_BALANCED', 'BUYER_INTENT', 'GEO_FRIENDLY']);

export const RecommendedTitleSchema = z.object({
  style: TitleStyleSchema,
  title: z.string().min(3).max(180),
  reason: z.string().min(4).max(500),
  usedFacts: z.array(z.string()).max(12).default([]),
  warnings: z.array(z.string()).max(12).default([]),
});

export const TitleOptimizeOutputSchema = z.object({
  originalTitle: z.string().min(1),
  coreProductTerm: z.string().min(1),
  problems: z.array(z.string()).max(12),
  recommendedTitles: z.array(RecommendedTitleSchema).length(3),
  keywordSuggestions: z.array(z.string().min(1).max(80)).max(3).default([]),
});

export type TitleOptimizeOutput = z.infer<typeof TitleOptimizeOutputSchema>;

export const TITLE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['originalTitle', 'coreProductTerm', 'problems', 'recommendedTitles', 'keywordSuggestions'],
  properties: {
    originalTitle: { type: 'string' },
    coreProductTerm: { type: 'string' },
    problems: { type: 'array', items: { type: 'string' } },
    keywordSuggestions: { type: 'array', items: { type: 'string' } },
    recommendedTitles: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['style', 'title', 'reason', 'usedFacts', 'warnings'],
        properties: {
          style: { type: 'string', enum: ['SEO_BALANCED', 'BUYER_INTENT', 'GEO_FRIENDLY'] },
          title: { type: 'string' },
          reason: { type: 'string' },
          usedFacts: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export function coerceTitleStyles(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const rec = data as Record<string, unknown>;
  const list = rec.recommendedTitles;
  if (!Array.isArray(list)) return data;
  const order = ['SEO_BALANCED', 'BUYER_INTENT', 'GEO_FRIENDLY'] as const;
  rec.recommendedTitles = list.slice(0, 3).map((item, i) => {
    if (!item || typeof item !== 'object') return item;
    const row = { ...(item as Record<string, unknown>) };
    if (!row.style) row.style = order[i];
    if (!Array.isArray(row.usedFacts)) row.usedFacts = [];
    if (!Array.isArray(row.warnings)) row.warnings = [];
    return row;
  });
  if (!Array.isArray(rec.problems)) rec.problems = [];
  if (!Array.isArray(rec.keywordSuggestions)) rec.keywordSuggestions = [];
  return rec;
}
