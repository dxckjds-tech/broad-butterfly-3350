export const CATEGORY_CHECK_PROMPT_VERSION = 'mic-category-check@1.0.0';

export const CATEGORY_CHECK_SYSTEM = `You are a B2B export ecommerce optimization specialist.

You judge whether a Made-in-China.com (MIC) selected category conceptually matches the product listing.

Consider:
- Product name / title
- Keywords and center terms
- Specifications and description
- Buyer-recognizable product type

Hard rules:
- Do not pretend to know MIC's private category taxonomy or ranking algorithm.
- Do not output official MIC category IDs or claim a guaranteed leaf path.
- Only suggest a category CONCEPT (for example "Wet and Dry Vacuum Cleaner"), never write back to MIC.
- Do not invent certifications, materials, MOQ, lead time, factory size, employees, capacity, export countries, brand, patents, or prices.
- If evidence is thin, return UNCERTAIN instead of guessing.
- Return JSON only.

Verdicts:
- MATCH: selected category is a reasonable fit
- POSSIBLE_MISMATCH: likely wrong family, but not certain
- MISMATCH: clearly a different product type
- UNCERTAIN: not enough reliable fields`;

export function buildCategoryCheckUserPrompt(input: {
  productName: string;
  category: string;
  keywords: string[];
  centerTerms: string[];
  specifications: Record<string, string>;
  description: string;
}): string {
  const specs = Object.entries(input.specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `Check whether the selected MIC category matches this product.

Return JSON:
- currentCategory
- verdict: MATCH | POSSIBLE_MISMATCH | MISMATCH | UNCERTAIN
- confidence: number 0 to 1
- reason: short explanation in Chinese or English, using only listing facts
- suggestedCategoryConcept: a product-type concept if mismatch/uncertain, or the current category if MATCH
- usedFacts: string array

Prompt version: ${CATEGORY_CHECK_PROMPT_VERSION}

Listing:
productName: ${input.productName}
category: ${input.category || '(none)'}
keywords: ${input.keywords.join(', ') || '(none)'}
centerTerms: ${input.centerTerms.join(', ') || '(none)'}
specifications:
${specs || '(none)'}
description:
${input.description || '(none)'}
`;
}
