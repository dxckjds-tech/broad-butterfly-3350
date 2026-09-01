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

const SELF_ATTEST = emptyPageData({
  platform: 'MADE_IN_CHINA',
  pageType: 'MIC_PRODUCT_EDIT',
  productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  title: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  category: 'Steam Cleaner',
  keywords: [
    'Steam Cleaner',
    'Wet and Dry Vacuum Cleaner',
    'Hospital Vacuum Cleaner',
    'Eco-Friendly Vacuum Cleaner',
    'ISO 9001 Vacuum Cleaner',
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

describe('Keyword self-attestation loop', () => {
  it('does not put keyword-only eco-friendly into verifiedAttributes', () => {
    const { profile } = inspectProductIdentity(SELF_ATTEST);
    expect(profile.verifiedAttributes.join(' ').toLowerCase()).not.toMatch(/eco friendly/);
    expect(profile.verifiedAttributes.join(' ')).toMatch(/high suction|heavy duty|industrial/i);
    expect(profile.certifications.join(' ').toLowerCase()).not.toMatch(/iso/);
    expect(profile.applications.join(' ').toLowerCase()).not.toMatch(/hospital/);
    expect(profile.unverifiedClaims.join(' ').toLowerCase()).toMatch(/eco friendly/);
    expect(profile.evidence.every((row) => row.source !== 'KEYWORD')).toBe(true);
  });

  it('still refuses keyword self-attestation after identityUserVerified', () => {
    const page = emptyPageData({ ...SELF_ATTEST, identityUserVerified: true });
    const { profile } = inspectProductIdentity(page);
    expect(profile.userVerified).toBe(true);
    expect(profile.verifiedAttributes.join(' ').toLowerCase()).not.toMatch(/eco friendly/);
    expect(profile.certifications.join(' ').toLowerCase()).not.toMatch(/iso/);
    const eco = gateKeyword('Eco-Friendly Vacuum Cleaner', page, profile);
    expect(eco.blockedReasons).toContain('UNVERIFIED_ATTRIBUTE');
    expect(eco.status).not.toBe('PRIMARY_ELIGIBLE');
    expect(eco.matchScore).toBeLessThan(100);
  });

  it('maps the live repro keywords to mismatch / unverified application / unverified attribute / unverified cert', () => {
    const { profile } = inspectProductIdentity(SELF_ATTEST);
    const steam = gateKeyword('Steam Cleaner', SELF_ATTEST, profile);
    const hospital = gateKeyword('Hospital Vacuum Cleaner', SELF_ATTEST, profile);
    const eco = gateKeyword('Eco-Friendly Vacuum Cleaner', SELF_ATTEST, profile);
    const iso = gateKeyword('ISO 9001 Vacuum Cleaner', SELF_ATTEST, profile);

    expect(steam.status).toBe('REJECTED_PRODUCT_MISMATCH');
    expect(steam.blockedReasons).toContain('PRODUCT_MISMATCH');

    expect(hospital.blockedReasons).toContain('APPLICATION_UNVERIFIED');
    expect(hospital.status).not.toBe('PRIMARY_ELIGIBLE');

    expect(eco.blockedReasons).toContain('UNVERIFIED_ATTRIBUTE');
    expect(eco.status).not.toBe('PRIMARY_ELIGIBLE');
    expect(eco.matchScore).not.toBe(100);

    expect(iso.blockedReasons).toContain('CERTIFICATION_UNVERIFIED');
    expect(iso.status).not.toBe('PRIMARY_ELIGIBLE');
  });

  it('keeps blocked phrases out of official Top3 even with fake VERIFIED evidence', () => {
    const { profile } = inspectProductIdentity(SELF_ATTEST);
    const { officialTop3, blocked, gated } = gateKeywordList(
      SELF_ATTEST.keywords ?? [],
      SELF_ATTEST,
      profile,
      (SELF_ATTEST.keywords ?? []).map((keyword) => ({
        keyword,
        status: 'VERIFIED' as const,
        demand: 1200,
        source: 'test-index',
      })),
    );
    expect(officialTop3.every((row) => row.blockedReasons.length === 0)).toBe(true);
    expect(officialTop3.every((row) => !/steam|hospital|eco|iso/i.test(row.keyword))).toBe(true);
    expect(blocked.some((k) => /eco/i.test(k.keyword) && k.reasons.includes('UNVERIFIED_ATTRIBUTE'))).toBe(true);
    expect(blocked.some((k) => /hospital/i.test(k.keyword) && k.reasons.includes('APPLICATION_UNVERIFIED'))).toBe(true);
    expect(blocked.some((k) => /iso/i.test(k.keyword) && k.reasons.includes('CERTIFICATION_UNVERIFIED'))).toBe(true);
    expect(blocked.some((k) => /steam/i.test(k.keyword) && k.reasons.includes('PRODUCT_MISMATCH'))).toBe(true);
    expect(gated.find((k) => /wet and dry vacuum cleaner/i.test(k.keyword))?.blockedReasons).toEqual([]);
  });

  it('leaves official Top3 empty when search evidence is missing', () => {
    const { profile } = inspectProductIdentity(SELF_ATTEST);
    const { officialTop3 } = gateKeywordList(SELF_ATTEST.keywords ?? [], SELF_ATTEST, profile);
    expect(officialTop3).toEqual([]);
  });

  it('allows certification / application / attribute only from title, specs, description, category, or cert fields', () => {
    const withFacts = emptyPageData({
      ...SELF_ATTEST,
      keywords: ['Eco-Friendly Vacuum Cleaner', 'Hospital Vacuum Cleaner', 'ISO 9001 Vacuum Cleaner'],
      certifications: ['ISO 9001'],
      specifications: {
        ...SELF_ATTEST.specifications,
        Application: 'Hospital ward cleaning',
      },
      description: 'Eco-friendly stainless steel vacuum for hospital use. ISO 9001 certified factory.',
    });
    const { profile } = inspectProductIdentity(withFacts);
    expect(profile.verifiedAttributes.join(' ').toLowerCase()).toMatch(/eco friendly/);
    expect(profile.applications.join(' ').toLowerCase()).toMatch(/hospital/);
    expect(profile.certifications.join(' ').toLowerCase()).toMatch(/iso/);
    expect(gateKeyword('Eco-Friendly Vacuum Cleaner', withFacts, profile).blockedReasons).not.toContain(
      'UNVERIFIED_ATTRIBUTE',
    );
    expect(gateKeyword('Hospital Vacuum Cleaner', withFacts, profile).blockedReasons).not.toContain(
      'APPLICATION_UNVERIFIED',
    );
    expect(gateKeyword('ISO 9001 Vacuum Cleaner', withFacts, profile).blockedReasons).not.toContain(
      'CERTIFICATION_UNVERIFIED',
    );
  });
});
