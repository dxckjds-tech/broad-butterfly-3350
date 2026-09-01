import { describe, expect, it } from 'vitest';
import { emptyPageData, type PlatformPageData } from '@trade-ai/shared-types';
import {
  guardGeneratedTitle,
  reasonAboutProduct,
  resetToolCache,
  resolveTrustedIdentity,
  titleRecommendationsPaused,
  unverifiedClaimReasons,
} from '../index';

function listing(overrides: Partial<PlatformPageData>): PlatformPageData {
  return emptyPageData({
    platform: 'MADE_IN_CHINA',
    pageType: 'MIC_PRODUCT_EDIT',
    url: 'https://membercenter.made-in-china.com/product/zn-560',
    ...overrides,
  });
}

/** Screenshot listing: grouping + model vs stale Steam Cleaner title. Product names belong in tests only. */
const SCREENSHOT = listing({
  productName: 'Heavy-Duty Steam Cleaner for Home and Industrial Use',
  title: 'Heavy-Duty Steam Cleaner for Home and Industrial Use',
  category: 'industrial Canister Vacuum Cleaner',
  specifications: { Model: 'ZN-560' },
  description: 'CE CB ETL RoHS certified. Heavy-duty steam cleaner for home and industrial use.',
  certifications: [],
});

describe('title intelligence for identity + verified claims', () => {
  it('pauses title generation until the grouping vs stale-title clash is confirmed', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(SCREENSHOT);
    expect(state.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH')).toBe(true);
    expect(titleRecommendationsPaused(SCREENSHOT, state, true)).toBe(true);
    const trusted = resolveTrustedIdentity(SCREENSHOT, state);
    expect(trusted.toLowerCase()).toMatch(/canister vacuum/);
    expect(trusted.toLowerCase()).not.toMatch(/steam/);
    expect(state.productProfile.certifications.every((c) => c.status !== 'VERIFIED')).toBe(true);
    const invented = unverifiedClaimReasons(
      'CE CB ETL RoHS Canister Vacuum Cleaner',
      state.productProfile,
    );
    expect(invented).toContain('CERTIFICATION_UNVERIFIED');
  });

  it('does not treat description certifications as VERIFIED after identityUserVerified', async () => {
    resetToolCache();
    const state = await reasonAboutProduct({ ...SCREENSHOT, identityUserVerified: true });
    expect(titleRecommendationsPaused({ ...SCREENSHOT, identityUserVerified: true }, state, false)).toBe(false);
    expect(state.productProfile.certifications.filter((c) => c.status === 'VERIFIED')).toEqual([]);
    const trusted = resolveTrustedIdentity({ ...SCREENSHOT, identityUserVerified: true }, state);
    const steam = guardGeneratedTitle(
      'Heavy-Duty Steam Cleaner CE CB ETL RoHS',
      trusted,
      state.productProfile,
    );
    expect(steam.ok).toBe(false);
    expect(steam.identityFailed).toBe(true);
    const vacuum = guardGeneratedTitle(
      `${trusted} ZN-560`,
      trusted,
      state.productProfile,
    );
    expect(vacuum.ok).toBe(true);
    expect(vacuum.cleaned.toLowerCase()).not.toMatch(/\b(ce|cb|etl|rohs)\b/);
    const certs = guardGeneratedTitle(
      `${trusted} CE CB ETL RoHS`,
      trusted,
      state.productProfile,
    );
    expect(certs.cleaned.toLowerCase()).not.toMatch(/\b(ce|cb|etl|rohs)\b/);
  });

  it('prefers a Type specification over a conflicting grouping', async () => {
    resetToolCache();
    const page = listing({
      productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
      title: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
      category: 'Steam Cleaner',
      specifications: { Type: 'Wet and Dry Vacuum Cleaner' },
    });
    const state = await reasonAboutProduct(page);
    expect(resolveTrustedIdentity(page, state).toLowerCase()).toMatch(/vacuum/);
    expect(resolveTrustedIdentity(page, state).toLowerCase()).not.toMatch(/steam/);
  });
});
