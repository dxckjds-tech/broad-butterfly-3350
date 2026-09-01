import type { PlatformPageData, SeoContinuation, UniversalProductProfile } from '@trade-ai/shared-types';
import { CERT_RE, PROTECTED_ATTRIBUTES, APPLICATION_SCENES, normalizeText } from '../knowledge/lexicon';
import { containsPhrase, identityPhrases } from '../knowledge/noun-phrase';
import { unverifiedClaimReasons } from '../knowledge/protected-claims';

function blockedReasons(keyword: string, profile: UniversalProductProfile): string[] {
  const reasons: string[] = [];
  const n = normalizeText(keyword);
  const identity = normalizeText(profile.identity.label);
  const catClash = profile.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH' && containsPhrase(keyword, c.right) && !containsPhrase(keyword, c.left));
  if (catClash) reasons.push('PRODUCT_MISMATCH');
  if (identity && !n.includes(identity.split(' ').slice(-1)[0] ?? '') && profile.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH')) {
    const other = profile.categoryCandidates[0]?.label;
    if (other && containsPhrase(keyword, other) && !containsPhrase(keyword, profile.identity.label)) {
      reasons.push('PRODUCT_MISMATCH');
    }
  }
  reasons.push(...unverifiedClaimReasons(keyword, profile));
  CERT_RE.lastIndex = 0;
  if (CERT_RE.test(keyword) && !profile.certifications.some((c) => c.status === 'VERIFIED')) {
    reasons.push('CERTIFICATION_UNVERIFIED');
  }
  CERT_RE.lastIndex = 0;
  for (const attr of PROTECTED_ATTRIBUTES) {
    if (!containsPhrase(keyword, attr)) continue;
    const verified = profile.dynamicAttributes.some((a) => a.status === 'VERIFIED' && normalizeText(a.name) === attr);
    if (!verified) reasons.push('UNVERIFIED_ATTRIBUTE');
  }
  for (const scene of APPLICATION_SCENES) {
    if (!containsPhrase(keyword, scene)) continue;
    const verified = profile.applications.some((a) => a.status === 'VERIFIED' && containsPhrase(a.value, scene));
    if (!verified) reasons.push('APPLICATION_UNVERIFIED');
  }
  return [...new Set(reasons)];
}

/** One-way: ProductProfile → keyword candidates. Never writes back to truth. */
export function planKeywords(page: PlatformPageData, profile: UniversalProductProfile): SeoContinuation {
  const snapshot = JSON.stringify(profile);
  const raw = [
    ...identityPhrases(page.productName || page.title || ''),
    ...Object.values(page.specifications ?? {}).flatMap((v) => identityPhrases(v)),
    ...profile.dynamicAttributes.filter((a) => a.status === 'VERIFIED').map((a) => `${a.name} ${profile.identity.label}`),
    ...(page.keywords ?? []),
  ]
    .map((k) => k.replace(/\s+/g, ' ').trim())
    .filter((k) => k.split(' ').length >= 2 && k.split(' ').length <= 6);

  const seen = new Set<string>();
  const candidateKeywords: SeoContinuation['candidateKeywords'] = [];
  for (const keyword of raw) {
    const key = normalizeText(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const reasons = blockedReasons(keyword, profile);
    candidateKeywords.push({
      keyword,
      status: reasons.length ? 'BLOCKED' : 'PENDING_VERIFICATION',
      reasons,
    });
  }

  if (JSON.stringify(profile) !== snapshot) {
    throw new Error('SEO must not write back to Product Truth.');
  }

  const conflict = profile.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH' || c.code === 'MATERIAL_CONFLICT');
  const low = profile.confidence.score < 0.6;
  const canProceed = !conflict || Boolean(page.identityUserVerified);
  const autoApplyAllowed = canProceed && !low && !conflict && Boolean(page.identityUserVerified);

  return {
    canProceed,
    autoApplyAllowed,
    officialTop3: [],
    candidateKeywords,
    searchDemand: 'NOT_AVAILABLE',
    note: 'No verified search evidence; official Top3 stays empty. Remaining phrases are pending verification.',
  };
}
