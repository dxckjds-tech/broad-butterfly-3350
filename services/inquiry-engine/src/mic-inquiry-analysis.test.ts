import { describe, expect, it } from 'vitest';
import { analyzeInquiry } from './analysis';
import type { MICInquiryRecord } from '@trade-ai/shared-types';

const base: MICInquiryRecord = {
  micInquiryId: 'x',
  subject: 'Need OEM 2000 pcs window handle lead time 20 days',
  buyerName: 'A',
  buyerCompany: 'B',
  buyerCountry: 'SE',
  productId: 'P1',
  productName: 'Window Handle',
  receivedAt: null,
  status: 'unreplied',
  assignedAccount: 'UNKNOWN',
  messagePreview: 'OEM 2000 pcs lead time 20 days',
  lastReplyAt: null,
  syncedAt: new Date().toISOString(),
  idConfidence: 1,
  source: 'MIC_VIRTUAL_OFFICE',
  evidenceLevel: 'VERIFIED',
};

describe('mic-inquiry-analysis', () => {
  it('marks OEM+qty as HIGH inferred', () => {
    expect(analyzeInquiry(base).buyerIntent).toBe('HIGH');
    expect(analyzeInquiry(base).evidenceLevel).toBe('INFERRED');
  });
});
