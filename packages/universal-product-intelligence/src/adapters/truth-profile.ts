import type {
  PlatformPageData,
  ProductTruthEvidence,
  ProductTruthProfile,
  ReasoningState,
} from '@trade-ai/shared-types';

/** V1 adapter: UniversalProductProfile → existing ProductTruthProfile. */
export function toProductTruthProfile(state: ReasoningState, page: PlatformPageData): ProductTruthProfile {
  const p = state.productProfile;
  const evidence: ProductTruthEvidence[] = p.evidence
    .filter((e) => e.channel !== 'KEYWORDS')
    .map((e) => ({
      field: e.field,
      value: e.value,
      source:
        e.channel === 'TITLE' || e.channel === 'PRODUCT_NAME'
          ? 'TITLE'
          : e.channel === 'CATEGORY'
            ? 'CATEGORY'
            : e.channel === 'SPEC'
              ? 'SPEC'
              : e.channel === 'DESCRIPTION'
                ? 'DESCRIPTION'
                : 'UNKNOWN',
    }));

  const verifiedAttributes = [
    ...p.dynamicAttributes.filter((a) => a.status === 'VERIFIED').map((a) => a.name),
    ...Object.entries(p.specifications)
      .filter(([k]) => /power|voltage|suction|material|application|type/i.test(k))
      .map(([k, v]) => `${k.replace(/^spec\./, '')}: ${v}`),
  ];

  return {
    coreProduct: p.identity.label,
    productFamily: p.identity.label,
    productType: p.specifications['spec.Type']?.replace(/^[^:]+:\s*/, '') || p.identity.label,
    verifiedAttributes: unique(verifiedAttributes),
    specifications: { ...(page.specifications ?? {}) },
    applications: unique(p.applications.filter((a) => a.status === 'VERIFIED').map((a) => a.value)),
    materials: unique(p.materials.filter((m) => m.status === 'VERIFIED').map((m) => m.value)),
    certifications: unique(p.certifications.filter((c) => c.status === 'VERIFIED').map((c) => c.value)),
    capabilities: [
      page.oemAvailable ? 'OEM' : '',
      page.moq ? `MOQ ${page.moq}` : '',
    ].filter(Boolean),
    unverifiedClaims: unique([
      ...state.conflicts.filter((c) => c.code === 'UNSUPPORTED_CLAIM').map((c) => c.right),
      ...p.dynamicAttributes.filter((a) => a.status === 'OBSERVED').map((a) => a.name),
    ]),
    conflictingClaims: p.conflicts.map((c) => `${c.left} vs ${c.right}`),
    evidence,
    identityConfidence: p.confidence.score,
    userVerified: Boolean(page.identityUserVerified),
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}
