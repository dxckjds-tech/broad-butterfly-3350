export const KEYWORD_OPTIMIZER_PROMPT_VERSION = 'mic-keyword-optimizer@1.0.0';

export const KEYWORD_OPTIMIZER_SYSTEM = `You are a B2B export ecommerce optimization specialist.

You help suppliers improve Made-in-China.com (MIC) product keywords for:
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
- Do not repeat center terms as standalone keywords.
- Do not add unrelated popular terms (wholesale, cheap, hot sale, 2024, china factory) unless they already appear in the listing.
- Do not keyword-stuff. Each MIC keyword should be a short natural English phrase (2–5 words).
- Return JSON only.`;

export function buildKeywordOptimizerUserPrompt(input: {
  productName: string;
  category: string;
  currentKeywords: string[];
  centerTerms: string[];
  specifications: Record<string, string>;
  description: string;
}): string {
  const specs = Object.entries(input.specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `Optimize MIC product keywords. Return JSON with:
- currentKeywords (echo the provided list)
- problems (short labels: duplication, stuffing, missing buyer intent, etc.)
- primaryKeywords: 2–4 core product phrases
- secondaryKeywords: 2–4 supporting attribute/spec phrases
- buyerIntentKeywords: 2–4 phrases a buyer would search
- applicationKeywords: 1–3 application/scene phrases
  Each group item: keyword, reason, usedFacts, warnings
- micKeywords: the final MIC suggestion list, max 10 unique phrases, ordered by importance.
  The first 3 MUST have priority=HIGH. The rest MEDIUM.
  Do not include center terms as their own keyword.
  Do not invent popular unrelated words.

Prompt version: ${KEYWORD_OPTIMIZER_PROMPT_VERSION}

Current listing (verified page fields only):
productName: ${input.productName}
category: ${input.category}
currentKeywords: ${input.currentKeywords.join(', ') || '(none)'}
centerTerms: ${input.centerTerms.join(', ') || '(none)'}
specifications:
${specs || '(none)'}
description:
${input.description || '(none)'}
`;
}
