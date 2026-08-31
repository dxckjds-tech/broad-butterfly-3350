import type { EvidenceChannel, EvidenceRecord, EvidenceTier } from '@trade-ai/shared-types';

const SELLER_CHANNELS = new Set<EvidenceChannel>(['TITLE', 'PRODUCT_NAME', 'KEYWORDS', 'CATEGORY']);

export type ClaimKind =
  | 'attribute'
  | 'application'
  | 'material'
  | 'certification'
  | 'performance'
  | 'specification';

export function tierForChannel(channel: EvidenceChannel): EvidenceTier {
  if (channel === 'SPEC' || channel === 'CERTIFICATION_FIELD') return 'STRUCTURED_FIELD' as const;
  if (channel === 'DESCRIPTION') return 'RELIABLE' as const;
  if (channel === 'IMAGE' || channel === 'SEARCH') return 'EXTERNAL' as const;
  if (channel === 'USER') return 'USER' as const;
  return 'SELLER_INPUT' as const;
}

export function isSellerInput(channel: EvidenceChannel): boolean {
  return SELLER_CHANNELS.has(channel);
}

/**
 * Claim-type specific verification.
 * DESCRIPTION/TITLE never verify certification, material, performance, or protected attributes.
 */
export function canVerifyClaim(kind: ClaimKind, channels: EvidenceChannel[]): boolean {
  if (kind === 'certification') {
    return channels.some((c) => c === 'CERTIFICATION_FIELD' || c === 'USER');
  }
  if (kind === 'material' || kind === 'performance' || kind === 'specification' || kind === 'attribute') {
    return channels.some((c) => c === 'SPEC' || c === 'USER');
  }
  if (kind === 'application') {
    return channels.some((c) => c === 'SPEC' || c === 'USER');
  }
  return false;
}

/** @deprecated use canVerifyClaim — kept so older call sites fail closed for mixed claims. */
export function canVerifyProtectedClaim(channels: EvidenceChannel[]): boolean {
  return canVerifyClaim('attribute', channels);
}

export function createEvidence(
  id: string,
  channel: EvidenceChannel,
  field: string,
  value: string,
): EvidenceRecord {
  const excerpt = value.replace(/\s+/g, ' ').trim().slice(0, 240);
  return { id, channel, field, value: excerpt, excerpt, tier: tierForChannel(channel) };
}

export function evidenceById(records: EvidenceRecord[], ids: string[]): EvidenceRecord[] {
  const map = new Map(records.map((e) => [e.id, e]));
  return ids.map((id) => map.get(id)).filter((e): e is EvidenceRecord => Boolean(e));
}

export function channelsOf(
  records: Array<{ id: string; channel: EvidenceChannel }>,
  ids: string[],
): EvidenceChannel[] {
  const map = new Map(records.map((e) => [e.id, e]));
  return [...new Set(ids.map((id) => map.get(id)?.channel).filter((c): c is EvidenceChannel => Boolean(c)))];
}
