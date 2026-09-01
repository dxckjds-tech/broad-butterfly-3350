import { describe, expect, it } from 'vitest';
import { emptyPageData } from '@trade-ai/shared-types';
import { identitiesCompatible, identityClash, reasonAboutProduct, resetToolCache } from '../index';

describe('generic identity compatibility', () => {
  it('treats plural and parent head nouns as compatible with a more specific product phrase', () => {
    expect(identitiesCompatible('industrial vacuum pump', 'pumps')).toBe(true);
    expect(identitiesCompatible('industrial vacuum pump', 'pump')).toBe(true);
    expect(identitiesCompatible('led flood light', 'lights')).toBe(true);
    expect(identitiesCompatible('solid wood dining chair', 'chairs')).toBe(true);
    expect(identitiesCompatible('centrifugal water pump', 'water pump')).toBe(true);
    expect(identitiesCompatible('brass ball valve', 'valves')).toBe(true);
    expect(identityClash('industrial vacuum pump', 'pumps')).toBe(false);
  });

  it('still flags true cross-category and same-head modifier clashes', () => {
    expect(identityClash('industrial vacuum pump', 'valves')).toBe(true);
    expect(identityClash('industrial vacuum pump', 'lights')).toBe(true);
    expect(identityClash('wet dry vacuum cleaner', 'steam cleaner')).toBe(true);
    expect(identityClash('dining chair', 'office mesh chair')).toBe(true);
    expect(identitiesCompatible('wet dry vacuum cleaner', 'steam cleaner')).toBe(false);
  });

  it('does not mark a specific listing as IDENTITY_MISMATCH against its parent plural category', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(
      emptyPageData({
        platform: 'MADE_IN_CHINA',
        pageType: 'MIC_PRODUCT_EDIT',
        productName: 'Industrial Vacuum Pump',
        title: 'Industrial Vacuum Pump',
        category: 'Pumps',
        keywords: ['stainless steel vacuum pump 500W'],
        specifications: { Power: '500W' },
      }),
    );
    expect(state.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH')).toBe(false);
    expect(state.status).not.toBe('CONFLICT');
    expect(state.productProfile.identity.label).toMatch(/pump/i);
  });
});
