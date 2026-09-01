import type { MICInquiryRecord, MICProductRecord, MICProductStatus } from '@trade-ai/shared-types';

export interface BusinessPriorityInput {
  opportunityScore: number;
  inquiries: MICInquiryRecord[];
  product: MICProductRecord;
  now?: number;
}

function statusWeight(status: MICProductStatus): number {
  if (status === 'ONLINE') return 90;
  if (status === 'PENDING_REVIEW') return 55;
  if (status === 'NEEDS_MODIFICATION') return 70;
  if (status === 'OFFLINE') return 30;
  if (status === 'DRAFT') return 20;
  return 40;
}

export function businessPriorityScore(input: BusinessPriorityInput): {
  score: number;
  usedInquirySignal: boolean;
  evidenceLevel: 'INFERRED' | 'UNKNOWN';
} {
  const now = input.now ?? Date.now();
  if (!input.inquiries.length) {
    return { score: input.opportunityScore, usedInquirySignal: false, evidenceLevel: 'UNKNOWN' };
  }

  const related = input.inquiries.filter(
    (i) =>
      i.productId === input.product.micProductId ||
      (i.productName && i.productName === input.product.productName),
  );
  const inquirySignal = Math.min(100, related.length * 18);
  const recency = related.some((i) => i.receivedAt && now - Date.parse(i.receivedAt) < 14 * 86400000)
    ? 80
    : 40;

  const createdHint = input.product.updatedAtRemote ? Date.parse(input.product.updatedAtRemote) : NaN;
  const ageDays = Number.isFinite(createdHint) ? (now - createdHint) / 86400000 : 60;
  const coverage = Math.min(1, Math.max(0.35, ageDays / 30));
  const adjustedInquiry = inquirySignal * coverage;

  const score = Math.round(
    input.opportunityScore * 0.5 +
      adjustedInquiry * 0.3 +
      statusWeight(input.product.status) * 0.1 +
      recency * 0.1,
  );
  return { score: Math.max(0, Math.min(100, score)), usedInquirySignal: true, evidenceLevel: 'INFERRED' };
}
