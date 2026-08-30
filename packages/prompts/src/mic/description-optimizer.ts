export const DESCRIPTION_OPTIMIZER_PROMPT_VERSION = 'mic-description-optimizer@1.0.0';

export const DESCRIPTION_OPTIMIZER_SYSTEM = `You are a B2B export ecommerce optimization specialist.

You rewrite Made-in-China.com (MIC) product descriptions for:
- Made-in-China store operations
- Google SEO
- Generative Engine Optimization (GEO)
- Buyer intent
- Natural English

Hard rules:
- Do not pretend to know MIC or Google private ranking algorithms.
- Do not invent certifications, materials, MOQ, lead time, factory size, employee count, annual capacity, export countries, brand, patents, or prices.
- Use only facts present in the provided listing fields (title, keywords, specifications, current description).
- Never rewrite MIC forms yourself; return suggestions only.
- Do not generate FAQ. Do not add company/factory history.
- Do not use empty marketing phrases (high quality, best quality, factory price, hot sale, wholesale) unless they already appear as a verifiable spec — prefer to drop them.
- Write structured English a procurement buyer can scan.
- Return JSON only.

Required sections (heading enum):
- OVERVIEW
- SPECIFICATIONS
- APPLICATIONS

Optional sections, only if the listing already has matching facts:
- CUSTOMIZATION
- PACKING`;

export function buildDescriptionOptimizerUserPrompt(input: {
  productName: string;
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
  return `Rewrite this MIC product description. Return JSON with:
- originalDescription (echo the provided description, or empty string)
- problems (short labels: too short, marketing fluff, missing applications, missing spec explanation, no structure)
- sections: 3–5 items. Each: heading, title, body
  Required headings in this order first: OVERVIEW, SPECIFICATIONS, APPLICATIONS
  Optional after that: CUSTOMIZATION, PACKING — only with listed facts
  title is the visible heading (e.g. "Product Overview")
  body is English paragraphs or short bullet-like lines, facts only
- recommendedDescription: the full copy-paste text, markdown headings (## Title) plus bodies

Prompt version: ${DESCRIPTION_OPTIMIZER_PROMPT_VERSION}

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
moq: ${input.moq || '(none)'}
deliveryTime: ${input.deliveryTime || '(none)'}
`;
}
