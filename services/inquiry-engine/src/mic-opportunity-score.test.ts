import { describe, expect, it } from 'vitest';
import { analyzeInquiry } from './analysis';
import type { MICInquiryRecord } from '@trade-ai/shared-types';

describe('mic-opportunity-score', () => {
  it('keeps price-only inquiries below high-intent', () => {
    const rec: MICInquiryRecord = {
      micInquiryId: 'p',
      subject: 'Please send price',
      buyerName: 'S',
      buyerCompany: 'T',
      buyerCountry: 'US',
      productId: '',
      productName: '',
      receivedAt: null,
      status: 'new',
      assignedAccount: 'UNKNOWN',
      messagePreview: 'Please send price',
      lastReplyAt: null,
      syncedAt: new Date().toISOString(),
      idConfidence: 1,
      source: 'MIC_VIRTUAL_OFFICE',
      evidenceLevel: 'VERIFIED',
    };
    expect(analyzeInquiry(rec).opportunityScore).toBeLessThan(80);
  });
});
