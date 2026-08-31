import { describe, expect, it } from 'vitest';
import { emptyPageData } from '@trade-ai/shared-types';
import { evaluateDiagnosis } from './index';
import { gateKeyword, gateKeywordList, isOfficialTop3Eligible } from './engine/keyword-gate';
import { inspectProductIdentity } from './engine/truth-profile';

const VACUUM = emptyPageData({
  platform: 'MADE_IN_CHINA',
  pageType: 'MIC_PRODUCT_EDIT',
  productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  title: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  category: 'Steam Cleaner',
  keywords: [
    'Heavy Duty Cleaner',
    'Wet and Dry Cleaner',
    'Industrial Use Cleaner',
    'Steam Cleaner',
  ],
  specifications: {
    Type: 'Wet and Dry Vacuum Cleaner',
    Power: '3000W',
    Suction: 'High Suction',
    Material: 'Stainless Steel',
    Application: 'Industrial workshop',
  },
  description: 'High quality industrial cleaner. Best quality factory price. Welcome to inquiry our hot sale product for export.',
  certifications: [],
});

describe('ProductTruthProfile + identity conflict', () => {
  it('builds a vacuum truth profile from listing facts', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    expect(profile.coreProduct).toMatch(/vacuum/i);
    expect(profile.productFamily).toMatch(/vacuum/i);
    expect(profile.verifiedAttributes.join(' ')).toMatch(/high suction|heavy duty|industrial/i);
    expect(profile.materials.join(' ').toLowerCase()).toMatch(/stainless/);
    expect(profile.applications.join(' ').toLowerCase()).toMatch(/workshop|industrial/);
    expect(profile.applications.join(' ').toLowerCase()).not.toMatch(/factory price/);
    expect(profile.userVerified).toBe(false);
    expect(profile.unverifiedClaims.join(' ')).toMatch(/factory price|hot sale|high quality/i);
  });

  it('flags Steam Cleaner vs Wet/Dry Vacuum as PRODUCT_IDENTITY_CONFLICT and pauses keywords', () => {
    const { conflict, keywordRecommendationsPaused, profile } = inspectProductIdentity(VACUUM);
    expect(conflict?.code).toBe('PRODUCT_IDENTITY_CONFLICT');
    expect(conflict?.hasConflict).toBe(true);
    expect(keywordRecommendationsPaused).toBe(true);
    expect(profile.conflictingClaims.length).toBeGreaterThan(0);
    const issue = evaluateDiagnosis(VACUUM).issues.find((i) => i.id === 'product-identity-conflict');
    expect(issue?.title).toMatch(/PRODUCT_IDENTITY_CONFLICT/);
  });

  it('does not pause keyword recommendations after userVerified', () => {
    const page = emptyPageData({ ...VACUUM, identityUserVerified: true });
    const { profile, conflict, keywordRecommendationsPaused } = inspectProductIdentity(page);
    expect(profile.userVerified).toBe(true);
    expect(conflict?.keywordRecommendationsPaused).toBe(false);
    expect(keywordRecommendationsPaused).toBe(false);
    const issue = evaluateDiagnosis(page).issues.find((i) => i.id === 'product-identity-conflict');
    expect(issue).toBeUndefined();
  });
});

describe('Keyword semantic gate', () => {
  it('rejects Steam Cleaner on a wet/dry vacuum listing', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const gated = gateKeyword('Steam Cleaner', VACUUM, profile);
    expect(gated.status).toBe('REJECTED_PRODUCT_MISMATCH');
    expect(gated.blockedReasons).toContain('PRODUCT_MISMATCH');
  });

  it('scores a listing-aligned vacuum phrase as PRIMARY_ELIGIBLE or SAFE_PRIMARY', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const gated = gateKeyword('wet and dry vacuum cleaner', VACUUM, profile);
    expect(gated.matchScore).toBeGreaterThanOrEqual(90);
    expect(['PRIMARY_ELIGIBLE', 'SAFE_PRIMARY_CANDIDATE']).toContain(gated.status);
    expect(gated.officialTop3Eligible).toBe(false);
  });

  it('blocks unverified hospital application and eco-friendly attribute', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const hospital = gateKeyword('hospital vacuum cleaner', VACUUM, profile);
    expect(hospital.blockedReasons).toContain('APPLICATION_UNVERIFIED');
    const eco = gateKeyword('eco friendly vacuum cleaner', VACUUM, profile);
    expect(eco.blockedReasons).toContain('UNVERIFIED_ATTRIBUTE');
  });

  it('never puts UNKNOWN demand into official Top3', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const { officialTop3, gated } = gateKeywordList(
      ['wet and dry vacuum cleaner', 'industrial vacuum cleaner'],
      VACUUM,
      profile,
    );
    expect(officialTop3).toEqual([]);
    expect(gated.every((k) => k.searchEvidence.demand === 'UNKNOWN')).toBe(true);
    expect(gated.every((k) => !isOfficialTop3Eligible(k.status, k.matchScore, k.searchEvidence))).toBe(true);
  });

  it('does not allow official Top3 when the phrase has blocked reasons', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const hospital = gateKeyword('hospital vacuum cleaner', VACUUM, profile, {
      keyword: 'hospital vacuum cleaner',
      status: 'VERIFIED',
      demand: 900,
      source: 'test-index',
    });
    expect(hospital.blockedReasons).toContain('APPLICATION_UNVERIFIED');
    expect(hospital.officialTop3Eligible).toBe(false);
  });

  it('allows official Top3 only with VERIFIED search evidence and match>=95', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const { officialTop3 } = gateKeywordList(['wet and dry vacuum cleaner'], VACUUM, profile, [
      { keyword: 'wet and dry vacuum cleaner', status: 'VERIFIED', demand: 1200, source: 'test-index' },
    ]);
    expect(officialTop3).toHaveLength(1);
    expect(officialTop3[0]?.matchScore).toBeGreaterThanOrEqual(95);
    expect(officialTop3[0]?.searchEvidence.status).toBe('VERIFIED');
  });

  it('blocks unverified certification claims', () => {
    const { profile } = inspectProductIdentity(VACUUM);
    const iso = gateKeyword('ISO 9001 vacuum cleaner', VACUUM, profile);
    expect(iso.blockedReasons).toContain('CERTIFICATION_UNVERIFIED');
  });
});
