import type { EvidenceChannel, EvidenceRecord, EvidenceTier } from '@trade-ai/shared-types';

const SELLER_CHANNELS = new Set<EvidenceChannel>(['TITLE', 'PRODUCT_NAME', 'KEYWORDS', 'CATEGORY']);

export function tierForChannel(channel: EvidenceChannel): EvidenceTier {
  if (channel === 'SPEC' || channel === 'CERTIFICATION_FIELD') return 'STRUCTURED_FIELD';
  if (channel === 'DESCRIPTION') return 'RELIABLE';
  if (channel === 'IMAGE' || channel === 'SEARCH') return 'EXTERNAL';
  if (channel === 'USER') return 'USER';
  return 'SELLER_INPUT';
}

export function isSellerInput(channel: EvidenceChannel): boolean {
  return SELLER_CHANNELS.has(channel);
}

/** Protected claims may be verified only by structured/reliable fields, not seller keywords or title-alone. */
export function canVerifyProtectedClaim(channels: EvidenceChannel[]): boolean {
  return channels.some((c) => c === 'SPEC' || c === 'DESCRIPTION' || c === 'CERTIFICATION_FIELD' || c === 'USER');
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

export function channelsOf(records: EvidenceRecord[], ids: string[]): EvidenceChannel[] {
  return [...new Set(evidenceById(records, ids).map((e) => e.channel))];
}
