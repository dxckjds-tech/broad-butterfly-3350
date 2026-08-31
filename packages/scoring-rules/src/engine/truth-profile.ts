import type {
  PlatformPageData,
  ProductIdentityConflict,
  ProductIdentityInspectPayload,
  ProductTruthEvidence,
  ProductTruthProfile,
} from '@trade-ai/shared-types';
import { emptyPageData } from '@trade-ai/shared-types';
import { gateKeywordList } from './keyword-gate';
import { detectCoreProductTerm } from './core-term';
import { detectProductFamily, familiesConflict, normalizeProductText } from './product-family';
import { specEntries } from './specs';

const MARKETING_CLAIMS = [
  'high quality',
  'best quality',
  'factory price',
  'hot sale',
  'wholesale',
  'welcome to inquiry',
  'competitive price',
];

const ATTRIBUTE_PHRASES = [
  'heavy duty',
  'high suction',
  'high pressure',
  'stainless steel',
  'wet and dry',
  'wet dry',
  'industrial',
  'commercial',
  'professional',
  'portable',
  'cordless',
  'waterproof',
  'eco friendly',
  'medical grade',
  'food grade',
];

const MATERIAL_RE = /\b(stainless steel|stainless|steel|aluminum|aluminium|plastic|abs|pp|pe|pvc|copper|brass|iron|rubber|wood)\b/gi;
const CERT_RE = /\b(iso\s?\d{3,5}|ce|fda|rohs|ul\s?\d*|sgs|tuv|iec\s?\d+|ccc|reach|gmp)\b/gi;

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalizeProductText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function applicationCorpus(page: PlatformPageData): string {
  const specApps = specEntries(page)
    .filter((s) => /application|used for|scene|industry/i.test(s.name))
    .map((s) => s.value);
  const desc = page.description ?? '';
  const phrases = desc.match(/\b(suitable for|used for|application[s]?[:\s]+)[^.!]{0,80}/gi) ?? [];
  return normalizeProductText([...specApps, ...phrases].join(' '));
}

export function buildProductTruthProfile(page: PlatformPageData): ProductTruthProfile {
  const title = page.productName || page.title || '';
  const titleFamily = detectProductFamily(title);
  const specType = specEntries(page).find((s) => /^type$/i.test(s.name))?.value ?? '';
  const specFamily = detectProductFamily(specType) ?? detectProductFamily(Object.values(page.specifications ?? {}).join(' '));
  const core = detectCoreProductTerm(page);
  const family = titleFamily ?? specFamily;
  const coreProduct = family?.core || core.coreProductTerm || title.slice(0, 80) || 'unknown product';
  const productFamily = family?.family || coreProduct;
  const productType = specType || family?.type || coreProduct;

  const specText = specEntries(page)
    .map((s) => `${s.name} ${s.value}`)
    .join(' ');
  const listing = `${title} ${specText} ${(page.keywords ?? []).join(' ')}`;
  const listingNorm = normalizeProductText(listing);

  const verifiedAttributes = unique(
    ATTRIBUTE_PHRASES.filter((p) => listingNorm.includes(normalizeProductText(p))).map((p) => p),
  );
  for (const spec of specEntries(page)) {
    if (/power|voltage|suction|tank|capacity|noise|material|application|type/i.test(spec.name) && spec.value.trim()) {
      verifiedAttributes.push(`${spec.name}: ${spec.value}`);
    }
  }

  const materials = unique([
    ...(listing.match(MATERIAL_RE) ?? []),
    ...specEntries(page)
      .filter((s) => /material/i.test(s.name))
      .map((s) => s.value),
  ]);
  const certifications = unique([...(page.certifications ?? []), ...(listing.match(CERT_RE) ?? [])]);
  const appsNorm = applicationCorpus(page);
  const applications = unique(
    specEntries(page)
      .filter((s) => /application|used for|scene/i.test(s.name))
      .map((s) => s.value)
      .concat(appsNorm ? [appsNorm] : []),
  );

  const capabilities: string[] = [];
  if (page.oemAvailable) capabilities.push('OEM');
  if (page.moq?.trim()) capabilities.push(`MOQ ${page.moq}`);
  if (page.deliveryTime?.trim()) capabilities.push(`lead time ${page.deliveryTime}`);

  const descNorm = normalizeProductText(page.description ?? '');
  const unverifiedClaims = unique(
    MARKETING_CLAIMS.filter((c) => descNorm.includes(normalizeProductText(c))),
  );

  const categoryFamily = detectProductFamily(page.category ?? '');
  const conflictingClaims: string[] = [];
  if (familiesConflict(titleFamily, categoryFamily)) {
    conflictingClaims.push(`title:${titleFamily?.id} vs category:${categoryFamily?.id}`);
  }
  if (familiesConflict(titleFamily, specFamily) && specType) {
    conflictingClaims.push(`title:${titleFamily?.id} vs spec:${specFamily?.id}`);
  }

  const evidence: ProductTruthEvidence[] = [];
  if (title) evidence.push({ field: 'productName', value: title, source: 'TITLE' });
  if (page.category) evidence.push({ field: 'category', value: page.category, source: 'CATEGORY' });
  for (const spec of specEntries(page)) {
    evidence.push({ field: spec.name, value: spec.value, source: 'SPEC' });
  }
  for (const keyword of (page.keywords ?? []).slice(0, 10)) {
    evidence.push({ field: 'keyword', value: keyword, source: 'KEYWORD' });
  }

  let identityConfidence = 0.4;
  if (titleFamily) identityConfidence += 0.25;
  if (specFamily && !familiesConflict(titleFamily, specFamily)) identityConfidence += 0.15;
  if (verifiedAttributes.length >= 2) identityConfidence += 0.1;
  if (conflictingClaims.length) identityConfidence = Math.min(identityConfidence, 0.45);
  if (page.identityUserVerified) identityConfidence = 1;
  identityConfidence = Math.min(1, Math.round(identityConfidence * 100) / 100);

  return {
    coreProduct,
    productFamily,
    productType,
    verifiedAttributes: unique(verifiedAttributes),
    specifications: { ...(page.specifications ?? {}) },
    applications,
    materials,
    certifications,
    capabilities,
    unverifiedClaims,
    conflictingClaims,
    evidence,
    identityConfidence,
    userVerified: Boolean(page.identityUserVerified),
  };
}

export function detectProductIdentityConflict(
  page: PlatformPageData,
  profile: ProductTruthProfile = buildProductTruthProfile(page),
): ProductIdentityConflict | null {
  const title = page.productName || page.title || '';
  const titleFamily = detectProductFamily(title);
  const categoryFamily = detectProductFamily(page.category ?? '');
  const specType = specEntries(page).find((s) => /^type$/i.test(s.name))?.value ?? '';
  const specFamily = detectProductFamily(specType);
  const descFamily = detectProductFamily(page.description ?? '');
  const keywordFamilies = (page.keywords ?? [])
    .map((k) => ({ keyword: k, family: detectProductFamily(k) }))
    .filter((row) => familiesConflict(titleFamily, row.family));

  const mismatch =
    familiesConflict(titleFamily, categoryFamily) ||
    familiesConflict(titleFamily, specFamily) ||
    familiesConflict(titleFamily, descFamily) ||
    keywordFamilies.length > 0;

  if (!mismatch) return null;

  const paused = !profile.userVerified;
  const summary = [
    titleFamily ? `标题产品：${titleFamily.type}` : `标题产品：${profile.coreProduct}`,
    categoryFamily ? `类目产品：${categoryFamily.type}` : page.category ? `类目：${page.category}` : '',
    keywordFamilies.length ? `冲突关键词：${keywordFamilies.map((k) => k.keyword).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('。');

  return {
    code: 'PRODUCT_IDENTITY_CONFLICT',
    hasConflict: true,
    titleProduct: titleFamily?.type || profile.coreProduct,
    categoryProduct: categoryFamily?.type || page.category || '',
    keywordProducts: keywordFamilies.map((k) => k.keyword),
    specProduct: specFamily?.type || specType,
    descriptionProduct: descFamily?.type || '',
    summary: `${summary}。不同产品身份，已暂停关键词推荐。`,
    keywordRecommendationsPaused: paused,
  };
}

export function inspectProductIdentity(page: PlatformPageData): {
  profile: ProductTruthProfile;
  conflict: ProductIdentityConflict | null;
  keywordRecommendationsPaused: boolean;
} {
  const profile = buildProductTruthProfile(page);
  const conflict = detectProductIdentityConflict(page, profile);
  return {
    profile,
    conflict,
    keywordRecommendationsPaused: Boolean(conflict?.keywordRecommendationsPaused),
  };
}

export interface ListingFactsInput {
  productName: string;
  category?: string;
  keywords?: string[];
  currentKeywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  moq?: string;
  deliveryTime?: string;
  companyName?: string;
  identityUserVerified?: boolean;
}

export function listingToPage(input: ListingFactsInput): PlatformPageData {
  const keywords = (input.currentKeywords ?? input.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  return emptyPageData({
    platform: 'MADE_IN_CHINA',
    pageType: 'MIC_PRODUCT_EDIT',
    url: input.url ?? '',
    title: input.productName,
    productName: input.productName,
    companyName: input.companyName ?? '',
    category: input.category ?? '',
    keywords,
    primaryKeywords: keywords.slice(0, 3),
    centerTerms: input.centerTerms ?? [],
    specifications: input.specifications ?? {},
    description: input.description ?? '',
    certifications: input.certifications ?? [],
    moq: input.moq ?? '',
    deliveryTime: input.deliveryTime ?? '',
    identityUserVerified: Boolean(input.identityUserVerified),
  });
}

export function inspectProductIdentityWithGate(page: PlatformPageData): ProductIdentityInspectPayload {
  const identity = inspectProductIdentity(page);
  const gated = gateKeywordList(page.keywords ?? [], page, identity.profile);
  return {
    profile: identity.profile,
    conflict: identity.conflict,
    keywordRecommendationsPaused: identity.keywordRecommendationsPaused,
    currentKeywordGate: gated.gated,
    blockedKeywords: gated.blocked,
  };
}
