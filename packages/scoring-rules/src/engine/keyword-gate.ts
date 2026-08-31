import type {
  BlockedKeyword,
  BlockedKeywordReason,
  GatedKeyword,
  KeywordGateStatus,
  PlatformPageData,
  ProductMatchBreakdown,
  ProductMatchScore,
  ProductTruthProfile,
  SearchEvidence,
} from '@trade-ai/shared-types';
import { pageTrustedClaimCorpus } from './claim-corpus';
import { detectProductFamily, familiesConflict, normalizeProductText } from './product-family';
import { buildProductTruthProfile } from './truth-profile';

const WEIGHTS = {
  core: 0.5,
  family: 0.2,
  attributes: 0.15,
  applications: 0.1,
  evidence: 0.05,
} as const;

const ATTRIBUTE_TOKENS = [
  'heavy duty',
  'high suction',
  'high pressure',
  'stainless steel',
  'waterproof',
  'portable',
  'cordless',
  'professional',
  'commercial',
  'industrial',
  'eco friendly',
  'medical grade',
  'food grade',
];

const APPLICATION_TOKENS = ['car', 'automotive', 'sofa', 'hospital', 'hotel', 'workshop', 'factory', 'clinic'];

const CERT_TOKENS = ['iso', 'ce', 'fda', 'rohs', 'ul', 'sgs', 'tuv', 'ccc', 'reach', 'gmp'];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function pct(n: number): number {
  return Math.round(clamp01(n) * 100);
}

function containsPhrase(hay: string, phrase: string): boolean {
  const h = normalizeProductText(hay);
  const p = normalizeProductText(phrase);
  if (!p) return true;
  if (p.length <= 3) return new RegExp(`\\b${p}\\b`).test(h);
  return h.includes(p);
}

function phrasesIn(text: string, phrases: string[]): string[] {
  return phrases.filter((p) => containsPhrase(text, p));
}

export function missingSearchEvidence(keyword: string): SearchEvidence {
  return { keyword, status: 'MISSING', demand: 'UNKNOWN' };
}

export function scoreKeywordAgainstProfile(
  keyword: string,
  profile: ProductTruthProfile,
  page: PlatformPageData,
): ProductMatchScore {
  const kw = normalizeProductText(keyword);
  const core = normalizeProductText(profile.coreProduct);
  const family = normalizeProductText(profile.productFamily);
  const trusted = pageTrustedClaimCorpus(page);
  const verifiedAttrHay = profile.verifiedAttributes.join(' ');
  const listing = [
    profile.coreProduct,
    profile.productFamily,
    profile.productType,
    verifiedAttrHay,
    ...Object.entries(profile.specifications).map(([k, v]) => `${k} ${v}`),
    ...profile.applications,
    ...profile.materials,
    ...profile.certifications,
    page.productName,
    page.title,
    page.category,
    page.description,
  ].join(' ');

  let coreScore = 0;
  if (core && (kw.includes(core) || core.split(' ').every((w) => w.length < 3 || kw.includes(w)))) coreScore = 1;
  else if (family && kw.includes(family.split(' ').slice(-2).join(' '))) coreScore = 0.7;
  else if (kw.split(' ').some((w) => w.length > 3 && core.includes(w))) coreScore = 0.45;

  const kwFamily = detectProductFamily(keyword);
  const profileFamily = detectProductFamily(`${profile.coreProduct} ${profile.productFamily} ${profile.productType}`);
  let familyScore = 0.5;
  if (kwFamily && profileFamily) familyScore = kwFamily.id === profileFamily.id ? 1 : 0;
  else if (family && (kw.includes(family) || family.split(' ').filter((w) => w.length > 3).every((w) => kw.includes(w)))) {
    familyScore = 1;
  }

  const kwAttrs = phrasesIn(keyword, ATTRIBUTE_TOKENS);
  const attrHay = `${verifiedAttrHay} ${trusted}`;
  const attrScore =
    kwAttrs.length === 0
      ? 1
      : kwAttrs.filter((a) => containsPhrase(attrHay, a)).length / kwAttrs.length;

  const kwApps = phrasesIn(keyword, APPLICATION_TOKENS);
  const appHay = profile.applications.join(' ');
  const appScore =
    kwApps.length === 0
      ? 1
      : kwApps.filter((a) => containsPhrase(appHay, a)).length / kwApps.length;

  const kwCerts = phrasesIn(keyword, CERT_TOKENS);
  const certHay = profile.certifications.join(' ');
  const unverifiedProtected =
    kwAttrs.some((a) => !containsPhrase(attrHay, a)) ||
    kwApps.some((a) => !containsPhrase(appHay, a)) ||
    kwCerts.some((c) => !containsPhrase(certHay, c));

  const tokens = kw.split(' ').filter((w) => w.length > 2);
  let evidenceScore =
    tokens.length === 0
      ? 0
      : tokens.filter((t) => containsPhrase(listing, t) || containsPhrase(appHay, t)).length / tokens.length;
  if (coreScore >= 1 && !unverifiedProtected) evidenceScore = Math.max(evidenceScore, 1);

  const breakdown: ProductMatchBreakdown = {
    core: pct(coreScore),
    family: pct(familyScore),
    attributes: pct(attrScore),
    applications: pct(appScore),
    evidence: pct(evidenceScore),
  };
  const rawTotal = Math.round(
    breakdown.core * WEIGHTS.core +
      breakdown.family * WEIGHTS.family +
      breakdown.attributes * WEIGHTS.attributes +
      breakdown.applications * WEIGHTS.applications +
      breakdown.evidence * WEIGHTS.evidence,
  );
  const total = unverifiedProtected ? Math.min(rawTotal, 79) : rawTotal;
  return { total, breakdown };
}

export function gateStatusForScore(total: number, productMismatch: boolean): KeywordGateStatus {
  if (productMismatch) return 'REJECTED_PRODUCT_MISMATCH';
  if (total >= 95) return 'PRIMARY_ELIGIBLE';
  if (total >= 90) return 'SAFE_PRIMARY_CANDIDATE';
  if (total >= 80) return 'SAFE_SECONDARY';
  if (total >= 65) return 'REVIEW_REQUIRED';
  return 'REJECTED';
}

export function blockedReasonsForKeyword(
  keyword: string,
  profile: ProductTruthProfile,
  page: PlatformPageData,
  productMismatch: boolean,
): BlockedKeywordReason[] {
  const reasons: BlockedKeywordReason[] = [];
  if (productMismatch) reasons.push('PRODUCT_MISMATCH');

  const kwAttrs = phrasesIn(keyword, ATTRIBUTE_TOKENS);
  const attrHay = `${profile.verifiedAttributes.join(' ')} ${pageTrustedClaimCorpus(page)}`;
  if (kwAttrs.some((a) => !containsPhrase(attrHay, a))) reasons.push('UNVERIFIED_ATTRIBUTE');

  const kwApps = phrasesIn(keyword, APPLICATION_TOKENS);
  const appHay = profile.applications.join(' ');
  if (kwApps.some((a) => !containsPhrase(appHay, a))) reasons.push('APPLICATION_UNVERIFIED');

  const kwCerts = phrasesIn(keyword, CERT_TOKENS);
  const certHay = profile.certifications.join(' ');
  if (kwCerts.some((c) => !containsPhrase(certHay, c))) reasons.push('CERTIFICATION_UNVERIFIED');

  return [...new Set(reasons)];
}

export function isOfficialTop3Eligible(
  status: KeywordGateStatus,
  matchScore: number,
  evidence: SearchEvidence,
): boolean {
  return (
    status === 'PRIMARY_ELIGIBLE' &&
    matchScore >= 95 &&
    evidence.status === 'VERIFIED' &&
    evidence.demand !== 'UNKNOWN'
  );
}

export function gateKeyword(
  keyword: string,
  page: PlatformPageData,
  profile: ProductTruthProfile = buildProductTruthProfile(page),
  searchEvidence: SearchEvidence = missingSearchEvidence(keyword),
): GatedKeyword {
  const kwFamily = detectProductFamily(keyword);
  const profileFamily = detectProductFamily(`${profile.coreProduct} ${profile.productFamily} ${page.productName}`);
  const productMismatch = familiesConflict(profileFamily, kwFamily);
  const match = scoreKeywordAgainstProfile(keyword, profile, page);
  const blockedReasons = blockedReasonsForKeyword(keyword, profile, page, productMismatch);
  const protectedBlock = blockedReasons.some(
    (r) =>
      r === 'UNVERIFIED_ATTRIBUTE' ||
      r === 'APPLICATION_UNVERIFIED' ||
      r === 'CERTIFICATION_UNVERIFIED' ||
      r === 'BLOCKED_BY_FACT_GUARD',
  );
  const total = productMismatch ? Math.min(match.total, 20) : match.total;
  let status = gateStatusForScore(total, productMismatch);
  if (protectedBlock && (status === 'PRIMARY_ELIGIBLE' || status === 'SAFE_PRIMARY_CANDIDATE' || status === 'SAFE_SECONDARY')) {
    status = 'REVIEW_REQUIRED';
  }
  const evidence: SearchEvidence = {
    ...searchEvidence,
    keyword,
    status: searchEvidence.status === 'VERIFIED' ? searchEvidence.status : 'MISSING',
    demand: searchEvidence.status === 'VERIFIED' ? searchEvidence.demand : 'UNKNOWN',
  };
  return {
    keyword,
    matchScore: total,
    breakdown: match.breakdown,
    status,
    blockedReasons,
    searchEvidence: evidence,
    officialTop3Eligible: isOfficialTop3Eligible(status, total, evidence) && blockedReasons.length === 0,
  };
}

export function gateKeywordList(
  keywords: string[],
  page: PlatformPageData,
  profile: ProductTruthProfile = buildProductTruthProfile(page),
  searchEvidence: SearchEvidence[] = [],
): { gated: GatedKeyword[]; blocked: BlockedKeyword[]; officialTop3: GatedKeyword[] } {
  const gated = keywords
    .map((keyword) => keyword.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((keyword) => {
      const ev = searchEvidence.find((s) => normalizeProductText(s.keyword) === normalizeProductText(keyword));
      return gateKeyword(keyword, page, profile, ev ?? missingSearchEvidence(keyword));
    });
  const blocked: BlockedKeyword[] = gated
    .filter((row) => row.blockedReasons.length > 0 || row.status === 'REJECTED_PRODUCT_MISMATCH')
    .map((row) => ({
      keyword: row.keyword,
      reasons: row.blockedReasons.length
        ? row.blockedReasons
        : (['PRODUCT_MISMATCH'] as BlockedKeywordReason[]),
      note:
        row.status === 'REJECTED_PRODUCT_MISMATCH'
          ? '与已确认产品身份不是同一产品。'
          : `门禁 ${row.status}，匹配分 ${row.matchScore}。`,
      matchScore: row.matchScore,
    }));
  const officialTop3 = gated.filter((row) => row.officialTop3Eligible).slice(0, 3);
  return { gated, blocked, officialTop3 };
}
