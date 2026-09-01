import { z } from 'zod';

export const CategoryVerdictSchema = z.enum(['MATCH', 'POSSIBLE_MISMATCH', 'MISMATCH', 'UNCERTAIN']);

export const CategoryCheckOutputSchema = z.object({
  currentCategory: z.string().min(1).max(160),
  verdict: CategoryVerdictSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(8).max(800),
  suggestedCategoryConcept: z.string().min(2).max(160),
  usedFacts: z.array(z.string()).max(12).default([]),
});

export type CategoryCheckOutput = z.infer<typeof CategoryCheckOutputSchema>;

export const CATEGORY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['currentCategory', 'verdict', 'confidence', 'reason', 'suggestedCategoryConcept', 'usedFacts'],
  properties: {
    currentCategory: { type: 'string' },
    verdict: { type: 'string', enum: ['MATCH', 'POSSIBLE_MISMATCH', 'MISMATCH', 'UNCERTAIN'] },
    confidence: { type: 'number' },
    reason: { type: 'string' },
    suggestedCategoryConcept: { type: 'string' },
    usedFacts: { type: 'array', items: { type: 'string' } },
  },
} as const;

export function looksLikeMicTaxonomyId(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (/^\d{3,}$/.test(s)) return true;
  if (/^[\d./_-]{3,}$/.test(s)) return true;
  if (/\bcategory[\s_-]?id\b/i.test(s) && /\d/.test(s)) return true;
  return false;
}

export function coerceCategoryOutput(data: unknown, currentCategory: string): unknown {
  if (!data || typeof data !== 'object') return data;
  const rec = { ...(data as Record<string, unknown>) };
  if (!rec.currentCategory) rec.currentCategory = currentCategory || 'unknown';
  const rawConfidence = rec.confidence;
  const parsedConfidence = typeof rawConfidence === 'string' ? Number(rawConfidence) : rawConfidence;
  if (typeof parsedConfidence === 'number' && Number.isFinite(parsedConfidence)) {
    const scaled = parsedConfidence > 1 ? parsedConfidence / 100 : parsedConfidence;
    rec.confidence = Math.min(1, Math.max(0, scaled));
  } else {
    rec.confidence = 0.5;
  }
  if (!Array.isArray(rec.usedFacts)) rec.usedFacts = [];
  else rec.usedFacts = rec.usedFacts.map(String).slice(0, 12);
  const v = String(rec.verdict || '').toUpperCase().replace(/\s+/g, '_');
  if (v === 'POSSIBLEMISMATCH') rec.verdict = 'POSSIBLE_MISMATCH';
  else if (['MATCH', 'POSSIBLE_MISMATCH', 'MISMATCH', 'UNCERTAIN'].includes(v)) rec.verdict = v;
  const concept = String(rec.suggestedCategoryConcept ?? '').trim();
  if (!concept || looksLikeMicTaxonomyId(concept)) {
    rec.suggestedCategoryConcept = currentCategory || 'Unknown product type';
  } else {
    rec.suggestedCategoryConcept = concept.slice(0, 160);
  }
  if (typeof rec.reason === 'string') rec.reason = rec.reason.slice(0, 800);
  return rec;
}
