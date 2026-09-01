import type { EvidenceRecord, PlatformPageData } from '@trade-ai/shared-types';
import { APPLICATION_SPEC_NAMES, IDENTITY_SPEC_NAMES, MARKETING_PHRASES, normalizeText } from '../knowledge/lexicon';
import { createEvidence } from './evidence';

export function observePage(page: PlatformPageData): EvidenceRecord[] {
  const out: EvidenceRecord[] = [];
  let n = 0;
  const add = (channel: EvidenceRecord['channel'], field: string, value: string) => {
    const v = value.replace(/\s+/g, ' ').trim();
    if (!v) return;
    n += 1;
    out.push(createEvidence(`e${n}`, channel, field, v));
  };

  add('PRODUCT_NAME', 'productName', page.productName || '');
  add('TITLE', 'title', page.title || page.productName || '');
  add('CATEGORY', 'category', page.category || '');
  for (const [k, v] of Object.entries(page.specifications ?? {})) {
    const channel = IDENTITY_SPEC_NAMES.test(k) || APPLICATION_SPEC_NAMES.test(k) ? 'SPEC' : 'SPEC';
    add(channel, `spec.${k}`, `${k}: ${v}`);
  }
  add('DESCRIPTION', 'description', page.description || '');
  for (const cert of page.certifications ?? []) add('CERTIFICATION_FIELD', 'certification', cert);
  for (const kw of page.keywords ?? []) add('KEYWORDS', 'keyword', kw);
  for (const kw of page.centerTerms ?? []) add('KEYWORDS', 'centerTerm', kw);
  for (const url of page.images ?? []) add('IMAGE', 'image', url);
  if (page.identityUserVerified) add('USER', 'identityUserVerified', 'true');
  return out;
}

export function marketingOnlyDescription(description: string): boolean {
  const n = normalizeText(description);
  if (!n) return true;
  const hits = MARKETING_PHRASES.filter((p) => n.includes(p)).length;
  const words = n.split(' ').filter(Boolean).length;
  return words > 0 && hits >= 2 && words < 40;
}
