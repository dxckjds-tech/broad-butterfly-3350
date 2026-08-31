import type { PlatformPageData } from '@trade-ai/shared-types';
import { normalizeProductText } from './product-family';

/** Protected claims may only be evidenced by title, specs, description, category, or form certifications. Never keywords. */
export function trustedClaimCorpus(input: {
  productName?: string;
  title?: string;
  category?: string;
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
}): string {
  const spec = Object.entries(input.specifications ?? {})
    .map(([k, v]) => `${k} ${v}`)
    .join(' ');
  return normalizeProductText(
    [
      input.productName,
      input.title,
      input.category,
      spec,
      input.description,
      ...(input.certifications ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function pageTrustedClaimCorpus(page: PlatformPageData): string {
  return trustedClaimCorpus({
    productName: page.productName,
    title: page.title,
    category: page.category,
    specifications: page.specifications,
    description: page.description,
    certifications: page.certifications,
  });
}

/** Candidate/current keywords and center terms must never evidence protected claims. */
export function pageKeywordCorpus(page: PlatformPageData): string {
  return normalizeProductText(
    [...(page.keywords ?? []), ...(page.primaryKeywords ?? []), ...(page.centerTerms ?? [])].join(' '),
  );
}

export function corpusHasPhrase(hay: string, phrase: string): boolean {
  const h = normalizeProductText(hay);
  const p = normalizeProductText(phrase);
  if (!p) return false;
  if (p.length <= 3) return new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(h);
  return h.includes(p);
}
