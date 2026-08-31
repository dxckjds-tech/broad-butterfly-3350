import type { FactRecord, FactStatus, PlatformPageData, UnknownRecord } from '@trade-ai/shared-types';
import {
  APPLICATION_SCENES,
  APPLICATION_SPEC_NAMES,
  CERT_RE,
  MARKETING_PHRASES,
  MATERIAL_SPEC_NAMES,
  PROTECTED_ATTRIBUTES,
  normalizeText,
} from '../knowledge/lexicon';
import { containsPhrase, splitPurpose } from '../knowledge/noun-phrase';
import { canVerifyProtectedClaim, channelsOf } from './evidence';
import type { EvidenceRecord } from '@trade-ai/shared-types';

export function collectUnknowns(page: PlatformPageData, evidence: EvidenceRecord[]): UnknownRecord[] {
  const unknowns: UnknownRecord[] = [];
  const has = (pred: (e: EvidenceRecord) => boolean) => evidence.some(pred);
  if (!page.images?.length) {
    unknowns.push({ id: 'u-images', slot: 'images', reason: 'No product images captured for visual facts.', blocking: false });
  }
  unknowns.push({
    id: 'u-image-analyzer',
    slot: 'imageAnalyzer',
    reason: 'Image analyzer is not connected; visual facts UNAVAILABLE.',
    blocking: false,
  });
  unknowns.push({
    id: 'u-search',
    slot: 'searchDataProvider',
    reason: 'Search demand provider is not connected; demand=NOT_AVAILABLE.',
    blocking: false,
  });
  if (!has((e) => e.channel === 'CERTIFICATION_FIELD')) {
    unknowns.push({ id: 'u-cert', slot: 'certifications', reason: 'No certification field on the page.', blocking: false });
  }
  if (!has((e) => e.channel === 'SPEC' && APPLICATION_SPEC_NAMES.test(e.field.replace(/^spec\./, '')))) {
    unknowns.push({ id: 'u-app', slot: 'applications', reason: 'No Application / Used-for specification.', blocking: false });
  }
  if (!has((e) => e.channel === 'SPEC' && MATERIAL_SPEC_NAMES.test(e.field.replace(/^spec\./, '')))) {
    unknowns.push({ id: 'u-mat', slot: 'materials', reason: 'No Material specification.', blocking: false });
  }
  if (!page.moq?.trim()) {
    unknowns.push({ id: 'u-moq', slot: 'moq', reason: 'MOQ is missing or not loaded.', blocking: false });
  }
  return unknowns;
}

export function extractFacts(evidence: EvidenceRecord[]): { verified: FactRecord[]; inferred: FactRecord[]; observed: FactRecord[] } {
  const verified: FactRecord[] = [];
  const inferred: FactRecord[] = [];
  const observed: FactRecord[] = [];
  let i = 0;
  const add = (
    kind: FactRecord['kind'],
    label: string,
    value: string,
    status: FactStatus,
    evidenceIds: string[],
    bucket: FactRecord[],
  ) => {
    i += 1;
    bucket.push({ id: `f${i}`, kind, label, value, status, evidenceIds });
  };

  for (const attr of PROTECTED_ATTRIBUTES) {
    const hits = evidence.filter((e) => containsPhrase(e.value, attr));
    if (!hits.length) continue;
    const ids = hits.map((e) => e.id);
    const ch = channelsOf(evidence, ids);
    const keywordOnly = hits.every((e) => e.channel === 'KEYWORDS');
    if (keywordOnly) {
      add('attribute', attr, attr, 'OBSERVED', ids, observed);
      continue;
    }
    if (canVerifyProtectedClaim(ch)) add('attribute', attr, attr, 'VERIFIED', ids, verified);
    else add('attribute', attr, attr, 'OBSERVED', ids, observed);
  }

  for (const ev of evidence.filter((e) => e.channel === 'SPEC' && MATERIAL_SPEC_NAMES.test(e.field.replace(/^spec\./, '')))) {
    add('material', 'material', ev.value.replace(/^[^:]+:\s*/, ''), 'VERIFIED', [ev.id], verified);
  }
  for (const ev of evidence.filter((e) => e.channel === 'SPEC' && APPLICATION_SPEC_NAMES.test(e.field.replace(/^spec\./, '')))) {
    add('application', 'application', ev.value.replace(/^[^:]+:\s*/, ''), 'VERIFIED', [ev.id], verified);
  }
  const purpose = evidence.find((e) => e.channel === 'TITLE' || e.channel === 'PRODUCT_NAME');
  if (purpose) {
    const { purpose: use } = splitPurpose(purpose.value);
    if (use) add('application', 'title-purpose', use, 'INFERRED', [purpose.id], inferred);
  }
  for (const scene of APPLICATION_SCENES) {
    const hits = evidence.filter((e) => containsPhrase(e.value, scene));
    if (!hits.length) continue;
    const trusted = hits.filter(
      (e) => e.channel === 'SPEC' && APPLICATION_SPEC_NAMES.test(e.field.replace(/^spec\./, '')),
    );
    if (trusted.length) add('application', scene, scene, 'VERIFIED', trusted.map((e) => e.id), verified);
    else if (hits.every((e) => e.channel === 'KEYWORDS')) add('application', scene, scene, 'OBSERVED', hits.map((e) => e.id), observed);
  }

  for (const ev of evidence.filter((e) => e.channel === 'CERTIFICATION_FIELD')) {
    add('certification', 'certification', ev.value, 'VERIFIED', [ev.id], verified);
  }
  for (const ev of evidence) {
    if (ev.channel === 'KEYWORDS') continue;
    const matches = ev.value.match(CERT_RE) ?? [];
    CERT_RE.lastIndex = 0;
    for (const m of matches) {
      if (ev.channel === 'CERTIFICATION_FIELD') continue;
      if (canVerifyProtectedClaim([ev.channel])) add('certification', 'certification', m, 'VERIFIED', [ev.id], verified);
      else add('certification', 'certification', m, 'OBSERVED', [ev.id], observed);
    }
  }
  for (const ev of evidence.filter((e) => e.channel === 'KEYWORDS')) {
    const matches = ev.value.match(CERT_RE) ?? [];
    CERT_RE.lastIndex = 0;
    for (const m of matches) add('certification', 'certification', m, 'OBSERVED', [ev.id], observed);
  }

  for (const phrase of MARKETING_PHRASES) {
    const hits = evidence.filter((e) => normalizeText(e.value).includes(phrase));
    if (hits.length) add('attribute', 'marketing', phrase, 'OBSERVED', hits.map((e) => e.id), observed);
  }

  for (const ev of evidence.filter((e) => e.channel === 'SPEC')) {
    add('specification', ev.field, ev.value, 'VERIFIED', [ev.id], verified);
  }

  return { verified, inferred, observed };
}
