import { z } from 'zod';

export const KeywordPrioritySchema = z.enum(['HIGH', 'MEDIUM']);

export const KeywordItemSchema = z.object({
  keyword: z.string().min(2).max(80),
  reason: z.string().min(4).max(400).default('Derived from listing facts.'),
  usedFacts: z.array(z.string()).max(8).default([]),
  warnings: z.array(z.string()).max(8).default([]),
  priority: KeywordPrioritySchema.optional(),
});

export const MicKeywordSchema = z.object({
  keyword: z.string().min(2).max(80),
  priority: KeywordPrioritySchema,
  reason: z.string().min(4).max(400).default('Suggested for MIC keyword slots.'),
});

export const KeywordOptimizeOutputSchema = z.object({
  currentKeywords: z.array(z.string()).max(20).default([]),
  problems: z.array(z.string()).max(12).default([]),
  primaryKeywords: z.array(KeywordItemSchema).max(6).default([]),
  secondaryKeywords: z.array(KeywordItemSchema).max(6).default([]),
  buyerIntentKeywords: z.array(KeywordItemSchema).max(6).default([]),
  applicationKeywords: z.array(KeywordItemSchema).max(6).default([]),
  micKeywords: z.array(MicKeywordSchema).min(1).max(10),
});

export type KeywordOptimizeOutput = z.infer<typeof KeywordOptimizeOutputSchema>;

export const KEYWORD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'currentKeywords',
    'problems',
    'primaryKeywords',
    'secondaryKeywords',
    'buyerIntentKeywords',
    'applicationKeywords',
    'micKeywords',
  ],
  properties: {
    currentKeywords: { type: 'array', items: { type: 'string' } },
    problems: { type: 'array', items: { type: 'string' } },
    primaryKeywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          reason: { type: 'string' },
          usedFacts: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    secondaryKeywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          reason: { type: 'string' },
          usedFacts: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    buyerIntentKeywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          reason: { type: 'string' },
          usedFacts: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    applicationKeywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          reason: { type: 'string' },
          usedFacts: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    micKeywords: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        required: ['keyword', 'priority'],
        properties: {
          keyword: { type: 'string' },
          priority: { type: 'string', enum: ['HIGH', 'MEDIUM'] },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

const BANNED_HOT = [
  'wholesale',
  'cheap',
  'hot sale',
  'best price',
  '2024',
  '2025',
  '2026',
  'china factory',
  'made in china',
  'free shipping',
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function coerceKeywordOutput(data: unknown, currentKeywords: string[]): unknown {
  if (!data || typeof data !== 'object') return data;
  const rec = data as Record<string, unknown>;
  for (const key of [
    'currentKeywords',
    'problems',
    'primaryKeywords',
    'secondaryKeywords',
    'buyerIntentKeywords',
    'applicationKeywords',
    'micKeywords',
  ]) {
    if (!Array.isArray(rec[key])) rec[key] = [];
  }
  if (!(rec.currentKeywords as string[]).length) rec.currentKeywords = currentKeywords;
  const mic = rec.micKeywords as unknown[];
  rec.micKeywords = mic.slice(0, 10).map((item, i) => {
    if (typeof item === 'string') {
      return { keyword: item, priority: i < 3 ? 'HIGH' : 'MEDIUM', reason: 'Suggested for MIC keyword slots.' };
    }
    if (!item || typeof item !== 'object') return item;
    const row = { ...(item as Record<string, unknown>) };
    if (typeof row.keyword !== 'string' && typeof row.phrase === 'string') row.keyword = row.phrase;
    if (row.priority !== 'HIGH' && row.priority !== 'MEDIUM') row.priority = i < 3 ? 'HIGH' : 'MEDIUM';
    if (typeof row.reason !== 'string' || !row.reason) row.reason = 'Suggested for MIC keyword slots.';
    return row;
  });
  return rec;
}

export function isBannedHotTerm(keyword: string, allowedCorpus: string): boolean {
  const n = norm(keyword);
  return BANNED_HOT.some((term) => n === term || n.includes(term)) && !allowedCorpus.includes(n);
}

export function isCenterTermRepeat(keyword: string, centerTerms: string[]): boolean {
  const n = norm(keyword);
  if (!n) return true;
  return centerTerms.some((term) => {
    const c = norm(term);
    return c.length > 0 && (n === c || n.split(' ').length === 1 && c === n);
  });
}

export function wordCount(keyword: string): number {
  return norm(keyword).split(' ').filter(Boolean).length;
}
