import type { MICProductRecord, MICSourcingRequest, QuoteDraft, RFQMatchResult } from '@trade-ai/shared-types';

function tokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter(
      (w) => !['the', 'and', 'for', 'with', 'from'].includes(w),
    ),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size || 1;
  return inter / union;
}

export function matchRfqToProducts(
  rfq: MICSourcingRequest,
  products: MICProductRecord[],
): RFQMatchResult[] {
  const rfqTokens = tokens(`${rfq.title} ${rfq.category}`);
  return products
    .map((p) => {
      const pt = tokens(`${p.productName} ${p.category} ${p.keywords.join(' ')}`);
      const overlap = jaccard(rfqTokens, pt);
      const categoryFit = rfq.category && p.category && rfq.category.toLowerCase() === p.category.toLowerCase() ? 0.2 : 0;
      const score = Math.round(Math.min(100, overlap * 80 + categoryFit * 100));
      const reasons: string[] = [];
      if (overlap > 0.15) reasons.push('title/keyword overlap');
      if (categoryFit) reasons.push('category match');
      if (!reasons.length) reasons.push('weak lexical overlap');
      return {
        productId: p.micProductId,
        productName: p.productName,
        score,
        reasons,
        evidenceLevel: 'INFERRED' as const,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function draftQuote(rfq: MICSourcingRequest, matches: RFQMatchResult[]): QuoteDraft {
  const top = matches.filter((m) => m.score >= 40).slice(0, 3);
  return {
    coverMessage: `Thank you for RFQ “${rfq.title}”. We can discuss matching items after quantity and specification confirmation. No price is offered until those facts are provided.`,
    recommendedProducts: top.map((m) => m.productName),
    questions: ['What is the target quantity?', 'What specifications or standards are required?'],
    quoteStructure: ['Product', 'Specification', 'Quantity', 'Unit price (PRICE_REQUIRED)', 'Lead time (to be confirmed)'],
    priceStatus: 'PRICE_REQUIRED',
    autoSend: false,
  };
}
