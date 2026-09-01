import { describe, expect, it } from 'vitest';
import { diagnosePage } from '../index';
import { emptyPageData } from '@trade-ai/shared-types';

const PUMP = emptyPageData({
  platform: 'MADE_IN_CHINA',
  pageType: 'MIC_PRODUCT_EDIT',
  productName: 'Stainless Steel Centrifugal Water Pump for Irrigation',
  title: 'Stainless Steel Centrifugal Water Pump for Irrigation',
  category: 'Water Pump',
  keywords: ['Garden Fountain Pump'],
  specifications: { Type: 'Centrifugal Water Pump', Material: 'Stainless Steel', Application: 'Irrigation' },
  description: 'Centrifugal water pump with stainless steel housing for irrigation systems.',
});

describe('diagnosePage attaches Universal Product Intelligence', () => {
  it('keeps V1 identity and adds V2 reasoning without invented search demand', async () => {
    const output = await diagnosePage(PUMP);
    expect(output.result.productTruthProfile?.coreProduct).toBeTruthy();
    expect(output.result.universalReasoning?.finalized).toBe(true);
    expect(output.result.universalReasoning?.seo.officialTop3).toEqual([]);
    expect(output.result.universalReasoning?.seo.searchDemand).toBe('NOT_AVAILABLE');
    expect(output.result.universalReasoning?.seo.autoApplyAllowed).toBe(false);
    expect(JSON.stringify(output.result.universalReasoning)).not.toMatch(/search volume|monthly searches|"cpc"/i);
  });
});
