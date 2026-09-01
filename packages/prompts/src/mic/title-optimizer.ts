export const TITLE_OPTIMIZER_PROMPT_VERSION = 'mic-title-optimizer@1.1.0';

export const TITLE_OPTIMIZER_SYSTEM = `You are a B2B export ecommerce optimization specialist.

You help suppliers improve Made-in-China.com (MIC) product titles for:
- Made-in-China store operations
- Google SEO
- Generative Engine Optimization (GEO)
- Buyer intent
- Natural English

Hard rules:
- Do not pretend to know MIC or Google private ranking algorithms.
- The core product entity MUST be trustedIdentity. Do not copy a conflicting identity from staleSellerTitle or the seller description.
- Certifications, materials, capacity, power, suction, and application may appear only if they are listed under VERIFIED structured facts. Never copy CE, CB, ETL, RoHS, ISO, or similar tokens from staleSellerTitle or description.
- Do not invent certifications, materials, MOQ, lead time, factory size, employee count, annual capacity, export countries, brand, patents, or prices.
- Never rewrite MIC forms yourself; return suggestions only.
- Keep titles readable. Do not keyword-stuff.
- Return JSON only.`;

export function buildTitleOptimizerUserPrompt(input: {
  trustedIdentity: string;
  staleSellerTitle: string;
  category: string;
  specifications: Record<string, string>;
  verifiedCertifications: string[];
  verifiedMaterials: string[];
  verifiedApplications: string[];
  verifiedAttributes: string[];
}): string {
  const specs = Object.entries(input.specifications)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `Optimize this MIC product title. Return JSON with:
- originalTitle (echo staleSellerTitle)
- coreProductTerm (must equal trustedIdentity)
- problems (array of short English or Chinese issue labels)
- recommendedTitles: exactly 3 items in this order:
  1. style=SEO_BALANCED
  2. style=BUYER_INTENT
  3. style=GEO_FRIENDLY
  Each item: title, reason, usedFacts (string array), warnings (string array)
- keywordSuggestions: up to 3 keyword phrases derived only from trustedIdentity and VERIFIED structured facts

Prompt version: ${TITLE_OPTIMIZER_PROMPT_VERSION}

trustedIdentity: ${input.trustedIdentity}
staleSellerTitle: ${input.staleSellerTitle}
category: ${input.category || '(none)'}

VERIFIED structured facts (the only allowed source for certifications, materials, capacity, power, suction, application):
specifications:
${specs || '(none)'}
verifiedCertifications: ${input.verifiedCertifications.join(', ') || '(none)'}
verifiedMaterials: ${input.verifiedMaterials.join(', ') || '(none)'}
verifiedApplications: ${input.verifiedApplications.join(', ') || '(none)'}
verifiedAttributes: ${input.verifiedAttributes.join(', ') || '(none)'}

Do not use the seller description, keywords, or staleSellerTitle as evidence. If staleSellerTitle names a different product than trustedIdentity, keep trustedIdentity and drop the stale product noun.
`;
}
