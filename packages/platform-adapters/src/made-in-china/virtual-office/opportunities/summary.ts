import type { MICInquiryRecord, MICOpportunitySummary } from '@trade-ai/shared-types';

export function buildOpportunitySummary(inquiries: MICInquiryRecord[], now = Date.now()): MICOpportunitySummary {
  const day = 24 * 60 * 60 * 1000;
  const unreplied = inquiries.filter((i) => /unreplied|pending|待回复|new/i.test(i.status) && !i.lastReplyAt);
  const productMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  for (const item of inquiries) {
    if (item.productName) productMap.set(item.productName, (productMap.get(item.productName) ?? 0) + 1);
    if (item.buyerCountry && item.buyerCountry !== 'UNKNOWN') {
      countryMap.set(item.buyerCountry, (countryMap.get(item.buyerCountry) ?? 0) + 1);
    }
  }
  const newInquiries = inquiries.filter((i) => {
    if (!i.receivedAt) return false;
    const t = Date.parse(i.receivedAt);
    return Number.isFinite(t) && now - t < day;
  }).length;

  return {
    newInquiries,
    unrepliedInquiries: unreplied.length,
    highIntentInquiries: 0,
    followUpNeeded: unreplied.filter((i) => {
      const t = i.receivedAt ? Date.parse(i.receivedAt) : NaN;
      return Number.isFinite(t) && now - t > day;
    }).length,
    newBuyers: new Set(inquiries.map((i) => i.buyerCompany)).size,
    productInterestRanking: [...productMap.entries()]
      .map(([productName, count]) => ({ productName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    countryDistribution: [...countryMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    syncedAt: new Date(now).toISOString(),
    evidenceLevel: 'VERIFIED',
  };
}
