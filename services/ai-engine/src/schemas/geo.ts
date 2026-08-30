import { z } from 'zod';

export const GeoVerdictSchema = z.enum(['STRONG', 'PARTIAL', 'WEAK', 'UNCERTAIN']);

export const GeoGapDimensionSchema = z.enum([
  'PRODUCT_ENTITY',
  'COMPANY_ENTITY',
  'SPECIFICATIONS',
  'APPLICATIONS',
  'FAQ',
  'EVIDENCE',
  'CERTIFICATIONS',
  'OEM',
  'BUYER_INTENT',
]);

export const GeoGapStatusSchema = z.enum(['PRESENT', 'WEAK', 'MISSING']);

export const GEO_GAP_DIMENSIONS = GeoGapDimensionSchema.options;

export const GeoGapSchema = z.object({
  dimension: GeoGapDimensionSchema,
  status: GeoGapStatusSchema,
  note: z.string().min(4).max(400),
});

export const GeoRecommendationSchema = z.object({
  title: z.string().min(4).max(80),
  body: z.string().min(12).max(800),
});

export const GeoFaqSchema = z.object({
  question: z.string().min(8).max(200),
  answer: z.string().min(8).max(800),
});

export const GeoAnalysisOutputSchema = z.object({
  productEntity: z.string().min(2).max(160),
  companyEntity: z.string().max(160).default(''),
  verdict: GeoVerdictSchema,
  score: z.number().min(0).max(1),
  summary: z.string().min(8).max(800),
  gaps: z.array(GeoGapSchema).min(3).max(9),
  recommendations: z.array(GeoRecommendationSchema).min(2).max(6),
  faqSuggestions: z.array(GeoFaqSchema).min(3).max(5),
});

export type GeoAnalysisOutput = z.infer<typeof GeoAnalysisOutputSchema>;
export type GeoGapDimension = z.infer<typeof GeoGapDimensionSchema>;
export type GeoGapStatus = z.infer<typeof GeoGapStatusSchema>;
export type GeoVerdict = z.infer<typeof GeoVerdictSchema>;

export const GEO_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'productEntity',
    'companyEntity',
    'verdict',
    'score',
    'summary',
    'gaps',
    'recommendations',
    'faqSuggestions',
  ],
  properties: {
    productEntity: { type: 'string' },
    companyEntity: { type: 'string' },
    verdict: { type: 'string', enum: ['STRONG', 'PARTIAL', 'WEAK', 'UNCERTAIN'] },
    score: { type: 'number' },
    summary: { type: 'string' },
    gaps: {
      type: 'array',
      minItems: 3,
      maxItems: 9,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'status', 'note'],
        properties: {
          dimension: {
            type: 'string',
            enum: [
              'PRODUCT_ENTITY',
              'COMPANY_ENTITY',
              'SPECIFICATIONS',
              'APPLICATIONS',
              'FAQ',
              'EVIDENCE',
              'CERTIFICATIONS',
              'OEM',
              'BUYER_INTENT',
            ],
          },
          status: { type: 'string', enum: ['PRESENT', 'WEAK', 'MISSING'] },
          note: { type: 'string' },
        },
      },
    },
    recommendations: {
      type: 'array',
      minItems: 2,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'body'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
      },
    },
    faqSuggestions: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
      },
    },
  },
} as const;

const DIMENSION_ALIASES: Record<string, GeoGapDimension> = {
  PRODUCT_ENTITY: 'PRODUCT_ENTITY',
  PRODUCT: 'PRODUCT_ENTITY',
  PRODUCTENTITY: 'PRODUCT_ENTITY',
  COMPANY_ENTITY: 'COMPANY_ENTITY',
  COMPANY: 'COMPANY_ENTITY',
  COMPANYENTITY: 'COMPANY_ENTITY',
  MANUFACTURER: 'COMPANY_ENTITY',
  SPECIFICATIONS: 'SPECIFICATIONS',
  SPECIFICATION: 'SPECIFICATIONS',
  SPECS: 'SPECIFICATIONS',
  APPLICATIONS: 'APPLICATIONS',
  APPLICATION: 'APPLICATIONS',
  FAQ: 'FAQ',
  EVIDENCE: 'EVIDENCE',
  CERTIFICATIONS: 'CERTIFICATIONS',
  CERTIFICATION: 'CERTIFICATIONS',
  CERTS: 'CERTIFICATIONS',
  OEM: 'OEM',
  OEM_CAPABILITY: 'OEM',
  BUYER_INTENT: 'BUYER_INTENT',
  BUYERINTENT: 'BUYER_INTENT',
};

const VERDICT_ALIASES: Record<string, GeoVerdict> = {
  STRONG: 'STRONG',
  GOOD: 'STRONG',
  HIGH: 'STRONG',
  PARTIAL: 'PARTIAL',
  MEDIUM: 'PARTIAL',
  FAIR: 'PARTIAL',
  WEAK: 'WEAK',
  LOW: 'WEAK',
  POOR: 'WEAK',
  UNCERTAIN: 'UNCERTAIN',
  UNKNOWN: 'UNCERTAIN',
};

const STATUS_ALIASES: Record<string, GeoGapStatus> = {
  PRESENT: 'PRESENT',
  STRONG: 'PRESENT',
  OK: 'PRESENT',
  WEAK: 'WEAK',
  PARTIAL: 'WEAK',
  MISSING: 'MISSING',
  ABSENT: 'MISSING',
  NONE: 'MISSING',
};

export const MISSING_FACT_ANSWER = '当前 listing 未写明该信息。';

export interface GeoCoerceContext {
  productName: string;
  companyName: string;
  specifications: Record<string, string>;
  description: string;
  certifications: string[];
  moq: string;
  deliveryTime: string;
}

function specLines(specs: Record<string, string>): string {
  return Object.entries(specs)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

function defaultFaqs(ctx: GeoCoerceContext): Array<{ question: string; answer: string }> {
  const specs = specLines(ctx.specifications);
  const certs = ctx.certifications.filter(Boolean).join(', ');
  return [
    {
      question: 'What product is listed on this page?',
      answer: ctx.productName
        ? `The listing title is ${ctx.productName}.`
        : MISSING_FACT_ANSWER,
    },
    {
      question: 'What specifications are stated on the listing?',
      answer: specs ? `The listing states: ${specs}.` : MISSING_FACT_ANSWER,
    },
    {
      question: 'Does the listing mention certifications?',
      answer: certs ? `The listing states: ${certs}.` : MISSING_FACT_ANSWER,
    },
    {
      question: 'What is the listed MOQ or lead time?',
      answer:
        ctx.moq || ctx.deliveryTime
          ? `MOQ: ${ctx.moq || 'not stated'}. Delivery time: ${ctx.deliveryTime || 'not stated'}.`
          : MISSING_FACT_ANSWER,
    },
  ].slice(0, 4);
}

function defaultRecommendations(ctx: GeoCoerceContext): Array<{ title: string; body: string }> {
  return [
    {
      title: 'Clarify product entity',
      body: ctx.productName
        ? `Keep the product type explicit in the description, matching the title: ${ctx.productName}.`
        : 'Add a clear product-type sentence at the start of the description.',
    },
    {
      title: 'Add buyer-intent FAQ',
      body: 'Add 3–5 FAQ answers using only facts already on the form (specs, MOQ, lead time). If a fact is not listed, write that it is not stated.',
    },
  ];
}

export function coerceGeoOutput(data: unknown, ctx: GeoCoerceContext): unknown {
  if (!data || typeof data !== 'object') return data;
  const rec = { ...(data as Record<string, unknown>) };

  const productEntity = String(rec.productEntity ?? ctx.productName ?? '').trim();
  rec.productEntity = (productEntity || ctx.productName || 'Unknown product').slice(0, 160);

  const companyEntity = String(rec.companyEntity ?? ctx.companyName ?? '').trim();
  rec.companyEntity = companyEntity.slice(0, 160);

  const verdictKey = String(rec.verdict || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  rec.verdict = VERDICT_ALIASES[verdictKey] ?? 'UNCERTAIN';

  const rawScore = rec.score;
  const parsedScore = typeof rawScore === 'string' ? Number(rawScore) : rawScore;
  if (typeof parsedScore === 'number' && Number.isFinite(parsedScore)) {
    const scaled = parsedScore > 1 ? parsedScore / 100 : parsedScore;
    rec.score = Math.min(1, Math.max(0, scaled));
  } else {
    rec.score = rec.verdict === 'STRONG' ? 0.75 : rec.verdict === 'PARTIAL' ? 0.45 : rec.verdict === 'WEAK' ? 0.25 : 0.2;
  }

  if (typeof rec.summary === 'string') rec.summary = rec.summary.trim().slice(0, 800);
  else rec.summary = `${rec.productEntity} GEO visibility is ${String(rec.verdict).toLowerCase()}.`;

  const seen = new Set<string>();
  const gaps: Array<Record<string, unknown>> = [];
  const rawGaps = Array.isArray(rec.gaps) ? rec.gaps : [];
  for (const item of rawGaps) {
    if (!item || typeof item !== 'object') continue;
    const row = { ...(item as Record<string, unknown>) };
    const dimKey = String(row.dimension || '')
      .toUpperCase()
      .replace(/[^A-Z]+/g, '_');
    const dimension = DIMENSION_ALIASES[dimKey];
    if (!dimension || seen.has(dimension)) continue;
    seen.add(dimension);
    const statusKey = String(row.status || '')
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    row.dimension = dimension;
    row.status = STATUS_ALIASES[statusKey] ?? 'WEAK';
    row.note = String(row.note ?? '').trim().slice(0, 400);
    if (String(row.note).length < 4) continue;
    gaps.push(row);
  }
  rec.gaps = gaps.slice(0, 9);

  const recs: Array<Record<string, unknown>> = [];
  const rawRecs = Array.isArray(rec.recommendations) ? rec.recommendations : [];
  for (const item of rawRecs) {
    if (!item || typeof item !== 'object') continue;
    const row = { ...(item as Record<string, unknown>) };
    row.title = String(row.title ?? '').trim().slice(0, 80);
    row.body = String(row.body ?? '').trim().slice(0, 800);
    if (String(row.title).length < 4 || String(row.body).length < 12) continue;
    recs.push(row);
  }
  for (const fallback of defaultRecommendations(ctx)) {
    if (recs.length >= 2) break;
    recs.push(fallback);
  }
  rec.recommendations = recs.slice(0, 6);

  const faqs: Array<Record<string, unknown>> = [];
  const rawFaqs = Array.isArray(rec.faqSuggestions) ? rec.faqSuggestions : [];
  for (const item of rawFaqs) {
    if (!item || typeof item !== 'object') continue;
    const row = { ...(item as Record<string, unknown>) };
    row.question = String(row.question ?? '').trim().slice(0, 200);
    row.answer = String(row.answer ?? '').trim().slice(0, 800);
    if (String(row.question).length < 8) continue;
    if (String(row.answer).length < 8) row.answer = MISSING_FACT_ANSWER;
    faqs.push(row);
  }
  for (const fallback of defaultFaqs(ctx)) {
    if (faqs.length >= 3) break;
    faqs.push(fallback);
  }
  rec.faqSuggestions = faqs.slice(0, 5);

  return rec;
}
