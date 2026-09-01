import type {
  PlatformPageData,
  ProductTruthProfile,
  ReasoningState,
  UniversalProductProfile,
} from '@trade-ai/shared-types';
import { IDENTITY_SPEC_NAMES } from '../knowledge/lexicon';
import { containsPhrase, identitiesCompatible } from '../knowledge/noun-phrase';
import {
  claimVerifiedInProfile,
  extractProtectedClaims,
  type ExtractedClaim,
} from '../knowledge/protected-claims';

export interface VerifiedTitleFacts {
  specifications: Record<string, string>;
  certifications: string[];
  materials: string[];
  applications: string[];
  attributes: string[];
}

export function identitySpecValue(page: PlatformPageData): string {
  const entry = Object.entries(page.specifications ?? {}).find(([key]) => IDENTITY_SPEC_NAMES.test(key));
  return entry?.[1]?.replace(/^[^:]+:\s*/, '').trim() ?? '';
}

/**
 * Core entity for title generation.
 * Structured Type/Name wins. If title and grouping clash and Type is absent, grouping wins.
 * Seller title is never the trusted core while an identity mismatch is open.
 */
export function resolveTrustedIdentity(page: PlatformPageData, reasoning: ReasoningState): string {
  const specType = identitySpecValue(page);
  const grouping = (page.category || reasoning.productProfile.categoryCandidates[0]?.label || '').trim();
  const mismatch = reasoning.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH');
  if (specType) return specType;
  if (mismatch && grouping) return grouping;
  return (
    reasoning.productProfile.identity.label ||
    grouping ||
    page.productName ||
    page.title ||
    'unknown product'
  );
}

export function titleRecommendationsPaused(
  page: PlatformPageData,
  reasoning: ReasoningState,
  v1IdentityPaused: boolean,
): boolean {
  if (page.identityUserVerified) return false;
  const identityMismatch = reasoning.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH');
  return identityMismatch || v1IdentityPaused;
}

export function verifiedFactsForTitle(profile: UniversalProductProfile, page: PlatformPageData): VerifiedTitleFacts {
  return {
    specifications: { ...(page.specifications ?? {}) },
    certifications: profile.certifications.filter((c) => c.status === 'VERIFIED').map((c) => c.value),
    materials: profile.materials.filter((m) => m.status === 'VERIFIED').map((m) => m.value),
    applications: profile.applications.filter((a) => a.status === 'VERIFIED').map((a) => a.value),
    attributes: profile.dynamicAttributes.filter((a) => a.status === 'VERIFIED').map((a) => a.value),
  };
}

export function titleMatchesTrustedIdentity(title: string, trustedIdentity: string): boolean {
  if (!trustedIdentity.trim()) return true;
  return identitiesCompatible(title, trustedIdentity);
}

function allowTitleClaim(claim: ExtractedClaim, profile: UniversalProductProfile, trustedIdentity: string): boolean {
  if (claimVerifiedInProfile(claim, profile)) return true;
  if (claim.kind === 'attribute' && containsPhrase(trustedIdentity, claim.token)) return true;
  return false;
}

export function guardGeneratedTitle(
  title: string,
  trustedIdentity: string,
  profile: UniversalProductProfile,
): { ok: boolean; cleaned: string; warnings: string[]; identityFailed: boolean } {
  const warnings: string[] = [];
  if (!titleMatchesTrustedIdentity(title, trustedIdentity)) {
    warnings.push(`TITLE_IDENTITY_GUARD: generated title does not match trusted identity "${trustedIdentity}".`);
    return { ok: false, cleaned: '', warnings, identityFailed: true };
  }

  let cleaned = title;
  for (const claim of extractProtectedClaims(title)) {
    if (allowTitleClaim(claim, profile, trustedIdentity)) continue;
    const pattern = new RegExp(`\\b${claim.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig');
    cleaned = cleaned.replace(pattern, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,./|-])/g, '$1').trim();
    warnings.push(`TITLE_CLAIM_GUARD: ${claim.reason} "${claim.token}"`);
  }

  for (const claim of extractProtectedClaims(cleaned)) {
    if (allowTitleClaim(claim, profile, trustedIdentity)) continue;
    warnings.push(`TITLE_CLAIM_GUARD: leftover ${claim.reason} "${claim.token}"`);
    return { ok: false, cleaned: '', warnings, identityFailed: false };
  }

  if (!cleaned) {
    return { ok: false, cleaned: '', warnings, identityFailed: false };
  }

  return { ok: true, cleaned, warnings, identityFailed: false };
}

export function withTrustedCore(profile: ProductTruthProfile, trustedIdentity: string): ProductTruthProfile {
  return {
    ...profile,
    coreProduct: trustedIdentity,
    productFamily: trustedIdentity,
    productType: trustedIdentity,
  };
}
