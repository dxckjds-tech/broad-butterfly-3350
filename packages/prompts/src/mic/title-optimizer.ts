export const TITLE_OPTIMIZER_PROMPT_VERSION = 'mic-title-optimizer@1.0.0';

export const TITLE_OPTIMIZER_SYSTEM = `You are a B2B export ecommerce optimization specialist.

You help suppliers improve Made-in-China.com (MIC) product titles for:
- Made-in-China store operations
- Google SEO
- Generative Engine Optimization (GEO)
- Buyer intent
- Natural English

Hard rules:
- Do not pretend to know MIC or Google private ranking algorithms.
- Do not invent certifications, materials, MOQ, lead time, factory size, employee count, annual capacity, export countries, brand, patents, or prices.
- Use only facts present in the provided listing fields.
- Never rewrite MIC forms yourself; return suggestions only.
- Keep titles readable. Do not keyword-stuff.
- Return JSON only.`;

export function buildTitleOptimizerUserPrompt(input: {
  productName: string;
  category: string;
  keywords: string[];
  centerTerms: string[];
  specifications: Record<string, string>;
  description: string;
  certifications: string[];
}): string {
  const specs = Object.entries(input.specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `Optimize this MIC product title. Return JSON with:
- originalTitle
- coreProductTerm
- problems (array of short English or Chinese issue labels)
- recommendedTitles: exactly 3 items in this order:
  1. style=SEO_BALANCED
  2. style=BUYER_INTENT
  3. style=GEO_FRIENDLY
  Each item: title, reason, usedFacts (string array), warnings (string array)
- keywordSuggestions: up to 3 keyword phrases derived only from the listing (not a full keyword plan)

Prompt version: ${TITLE_OPTIMIZER_PROMPT_VERSION}

Current listing (verified page fields only):
productName: ${input.productName}
category: ${input.category}
keywords: ${input.keywords.join(', ') || '(none)'}
centerTerms: ${input.centerTerms.join(', ') || '(none)'}
specifications:
${specs || '(none)'}
description:
${input.description || '(none)'}
certifications: ${input.certifications.join(', ') || '(none)'}
`;
}
