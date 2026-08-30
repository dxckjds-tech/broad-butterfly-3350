import { describe, expect, it } from 'vitest';
import { matchRfqToProducts } from './rfq-match';
import type { MICProductRecord, MICSourcingRequest } from '@trade-ai/shared-types';

describe('rfq-match', () => {
  it('scores overlapping product names', () => {
    const rfq = {
      micRequestId: '1',
      title: 'window handle casement',
      category: 'Window Hardware',
      country: 'DE',
      quantity: '1',
      unit: 'pcs',
      publishedAt: null,
      deadline: null,
      status: 'open',
      matchingProducts: [],
      syncedAt: '',
      idConfidence: 1,
      source: 'MIC_VIRTUAL_OFFICE',
      evidenceLevel: 'VERIFIED',
    } as MICSourcingRequest;
    const products = [
      {
        micProductId: 'a',
        productName: 'Aluminum Casement Window Handle',
        productUrl: '',
        model: '',
        category: 'Window Hardware',
        status: 'ONLINE',
        keywords: ['window', 'handle'],
        attributes: {},
        tradeInfo: '',
        isFeaturedProduct: false,
        featuredScore: null,
        mainProductScore: null,
        updatedAtRemote: null,
        syncedAt: '',
        rawSourceHash: 'x',
        idConfidence: 1,
        source: 'MIC_VIRTUAL_OFFICE',
        evidenceLevel: 'VERIFIED',
      },
    ] as MICProductRecord[];
    expect(matchRfqToProducts(rfq, products)[0]?.score).toBeGreaterThan(20);
  });
});
