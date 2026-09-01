import type { UniversalProductProfile } from '@trade-ai/shared-types';
import {
  APPLICATION_SCENES,
  CERT_RE,
  COMPATIBILITY_MARKERS,
  MATERIAL_FAMILIES,
  PERFORMANCE_MEASURE_RE,
  PROTECTED_ATTRIBUTES,
  SPECIFICATION_TOKEN_RE,
  normalizeText,
} from './lexicon';
import { containsPhrase } from './noun-phrase';

export type KeywordBlockReason =
  | 'UNVERIFIED_ATTRIBUTE'
  | 'APPLICATION_UNVERIFIED'
  | 'CERTIFICATION_UNVERIFIED'
  | 'MATERIAL_UNVERIFIED'
  | 'PERFORMANCE_UNVERIFIED'
  | 'SPECIFICATION_UNVERIFIED'
  | 'COMPATIBILITY_UNVERIFIED';

export interface ExtractedClaim {
  kind: 'attribute' | 'application' | 'material' | 'certification' | 'performance' | 'specification' | 'compatibility';
  token: string;
  reason: KeywordBlockReason;
}

function resetRe(re: RegExp): void {
  re.lastIndex = 0;
}

function uniqueMeasures(text: string, re: RegExp): string[] {
  resetRe(re);
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = normalizeText(m[0]);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  resetRe(re);
  return out;
}

/** Generic protected claims in a phrase. No product-name branches. */
export function extractProtectedClaims(text: string): ExtractedClaim[] {
  const n = normalizeText(text);
  if (!n) return [];
  const claims: ExtractedClaim[] = [];

  resetRe(CERT_RE);
  const certs = text.match(CERT_RE) ?? [];
  resetRe(CERT_RE);
  for (const token of certs) {
    claims.push({ kind: 'certification', token: normalizeText(token), reason: 'CERTIFICATION_UNVERIFIED' });
  }

  const materials = Object.values(MATERIAL_FAMILIES)
    .flat()
    .sort((a, b) => b.length - a.length);
  const usedMaterial = new Set<string>();
  for (const mat of materials) {
    if (!containsPhrase(n, mat)) continue;
    if ([...usedMaterial].some((u) => u.includes(mat) || mat.includes(u))) continue;
    usedMaterial.add(mat);
    claims.push({ kind: 'material', token: mat, reason: 'MATERIAL_UNVERIFIED' });
  }

  for (const token of uniqueMeasures(n, SPECIFICATION_TOKEN_RE)) {
    claims.push({ kind: 'specification', token, reason: 'SPECIFICATION_UNVERIFIED' });
  }

  for (const token of uniqueMeasures(n, PERFORMANCE_MEASURE_RE)) {
    claims.push({ kind: 'performance', token, reason: 'PERFORMANCE_UNVERIFIED' });
  }

  for (const marker of COMPATIBILITY_MARKERS) {
    if (containsPhrase(n, marker)) {
      claims.push({ kind: 'compatibility', token: marker, reason: 'COMPATIBILITY_UNVERIFIED' });
    }
  }

  for (const attr of PROTECTED_ATTRIBUTES) {
    if (containsPhrase(n, attr)) {
      claims.push({ kind: 'attribute', token: attr, reason: 'UNVERIFIED_ATTRIBUTE' });
    }
  }

  for (const scene of APPLICATION_SCENES) {
    if (containsPhrase(n, scene)) {
      claims.push({ kind: 'application', token: scene, reason: 'APPLICATION_UNVERIFIED' });
    }
  }

  const seen = new Set<string>();
  return claims.filter((c) => {
    const k = `${c.kind}:${c.token}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function verifiedCorpus(profile: UniversalProductProfile): string {
  const materials = profile.materials.filter((m) => m.status === 'VERIFIED').map((m) => m.value);
  const apps = profile.applications.filter((a) => a.status === 'VERIFIED').map((a) => a.value);
  const certs = profile.certifications.filter((c) => c.status === 'VERIFIED').map((c) => c.value);
  const attrs = profile.dynamicAttributes.filter((a) => a.status === 'VERIFIED').map((a) => `${a.name} ${a.value}`);
  const specs = Object.values(profile.specifications);
  return normalizeText([...materials, ...apps, ...certs, ...attrs, ...specs].join(' '));
}

export function claimVerifiedInProfile(claim: ExtractedClaim, profile: UniversalProductProfile): boolean {
  const hay = verifiedCorpus(profile);
  if (!hay) return false;
  if (claim.kind === 'certification') {
    return profile.certifications.some((c) => c.status === 'VERIFIED' && containsPhrase(c.value, claim.token));
  }
  if (claim.kind === 'material') {
    return (
      profile.materials.some((m) => m.status === 'VERIFIED' && containsPhrase(m.value, claim.token)) ||
      containsPhrase(hay, claim.token)
    );
  }
  if (claim.kind === 'attribute') {
    return profile.dynamicAttributes.some(
      (a) => a.status === 'VERIFIED' && (normalizeText(a.name) === claim.token || containsPhrase(a.value, claim.token)),
    );
  }
  if (claim.kind === 'application') {
    return profile.applications.some((a) => a.status === 'VERIFIED' && containsPhrase(a.value, claim.token));
  }
  if (claim.kind === 'performance' || claim.kind === 'specification') {
    return containsPhrase(hay, claim.token);
  }
  if (claim.kind === 'compatibility') {
    return containsPhrase(hay, claim.token);
  }
  return false;
}

/** One-way: keyword → block reasons against VERIFIED profile facts. Never writes the keyword into truth. */
export function unverifiedClaimReasons(keyword: string, profile: UniversalProductProfile): KeywordBlockReason[] {
  const reasons: KeywordBlockReason[] = [];
  for (const claim of extractProtectedClaims(keyword)) {
    if (!claimVerifiedInProfile(claim, profile)) reasons.push(claim.reason);
  }
  return [...new Set(reasons)];
}
