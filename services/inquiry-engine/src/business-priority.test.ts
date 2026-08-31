import { describe, expect, it } from 'vitest';
import { businessPriorityScore } from './business-priority';
import type { MICProductRecord } from '@trade-ai/shared-types';

describe('business-priority', () => {
  it('uses opportunity when inquiries missing', () => {
    const product = { micProductId: 'P1', productName: 'X', status: 'ONLINE' } as MICProductRecord;
    const r = businessPriorityScore({ opportunityScore: 70, inquiries: [], product });
    expect(r.score).toBe(70);
    expect(r.usedInquirySignal).toBe(false);
  });
});
