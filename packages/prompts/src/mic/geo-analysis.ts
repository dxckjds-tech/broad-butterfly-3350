export const GEO_ANALYSIS_PROMPT_VERSION = 'mic-geo-analysis@1.0.0';

export const GEO_ANALYSIS_SYSTEM = `You are a B2B export ecommerce optimization specialist.

You evaluate whether a Made-in-China.com (MIC) product listing can be understood and cited by AI systems (Generative Engine Optimization / GEO).

Check these dimensions:
- Product entity (clear product type)
- Company entity (manufacturer identity beyond a name)
- Specifications (numeric / verifiable attributes)
- Applications (usedFor / industry scenes)
- FAQ (question-answer structure)
- Evidence (facts a buyer or model can verify)
- Certifications (only if listed)
- OEM capability (only if listed)
- Buyer-intent questions (MOQ, lead time, samples, customization)

Hard rules:
- Do not pretend to know MIC, Google, or any AI citation / ranking algorithm.
- Do not invent certifications, materials, MOQ, lead time, factory size, employee count, annual capacity, export countries, brand, patents, or prices.
- Use only facts present in the provided listing fields.
- Suggestions only; never write MIC forms.
- Do not generate a full FAQ product page. Return 3–5 buyer-intent Q&A pairs.
- If a fact is missing, the FAQ answer must say the listing does not state it. Do not invent an answer.
- Recommendations may tell the seller what kind of fact to add, but must not invent specific industry names, certification names, factory size, employee counts, or numbers that are not on the listing.
- Return JSON only.

Verdicts:
- STRONG: product + company + specs + applications are clear, with FAQ or strong evidence
- PARTIAL: some entities/specs exist, but FAQ, OEM, certifications, or scenes are thin
- WEAK: mostly marketing copy or missing entities
- UNCERTAIN: not enough reliable fields`;

export function buildGeoAnalysisUserPrompt(input: {
  productName: string;
  companyName: string;
  category: string;
  keywords: string[];
  centerTerms: string[];
  specifications: Record<string, string>;
  description: string;
  certifications: string[];
  moq: string;
  deliveryTime: string;
}): string {
  const specs = Object.entries(input.specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `Evaluate GEO / AI visibility for this MIC listing. Return JSON with:
- productEntity: short product-type phrase from the listing
- companyEntity: company name if present, else empty string
- verdict: STRONG | PARTIAL | WEAK | UNCERTAIN
- score: number 0 to 1
- summary: short explanation in Chinese or English, listing facts only
- gaps: array covering these dimensions when relevant:
  PRODUCT_ENTITY, COMPANY_ENTITY, SPECIFICATIONS, APPLICATIONS, FAQ, EVIDENCE, CERTIFICATIONS, OEM, BUYER_INTENT
  each: { dimension, status: PRESENT | WEAK | MISSING, note }
- recommendations: 2–6 items { title, body } — copyable GEO snippets, facts only
- faqSuggestions: 3–5 items { question, answer } — answers only from listing facts; if missing, say the listing does not state it

Prompt version: ${GEO_ANALYSIS_PROMPT_VERSION}

Listing:
productName: ${input.productName}
companyName: ${input.companyName || '(none)'}
category: ${input.category || '(none)'}
keywords: ${input.keywords.join(', ') || '(none)'}
centerTerms: ${input.centerTerms.join(', ') || '(none)'}
specifications:
${specs || '(none)'}
description:
${input.description || '(none)'}
certifications: ${input.certifications.join(', ') || '(none)'}
moq: ${input.moq || '(none)'}
deliveryTime: ${input.deliveryTime || '(none)'}
`;
}
