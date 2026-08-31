import { describe, expect, it } from 'vitest';
import { emptyPageData, type PlatformPageData } from '@trade-ai/shared-types';
import {
  extractProtectedClaims,
  planKeywords,
  reasonAboutProduct,
  resetToolCache,
  unverifiedClaimReasons,
} from '../index';
import { canVerifyClaim, createEvidence } from '../engine/evidence';
import { observePage } from '../engine/observe';
import { extractFacts } from '../engine/state';
import { FIXTURES } from './fixtures';

function listing(overrides: Partial<PlatformPageData>): PlatformPageData {
  return emptyPageData({
    platform: 'MADE_IN_CHINA',
    pageType: 'MIC_PRODUCT_EDIT',
    ...overrides,
  });
}

function seoFor(keyword: string, state: Awaited<ReturnType<typeof reasonAboutProduct>>) {
  return state.seo.candidateKeywords.find((k) => k.keyword.toLowerCase() === keyword.toLowerCase());
}

describe('generic protected claims in keywords', () => {
  it('extracts material/performance/specification/compatibility without product-name branches', () => {
    const materials = extractProtectedClaims('Stainless Steel Pump');
    expect(materials.some((c) => c.kind === 'material' && c.token === 'stainless steel')).toBe(true);
    expect(extractProtectedClaims('Aluminum Frame').some((c) => c.kind === 'material' && c.token === 'aluminum')).toBe(
      true,
    );
    expect(extractProtectedClaims('15kW Water Pump').some((c) => c.kind === 'performance' && /15\s*kw/i.test(c.token))).toBe(
      true,
    );
    expect(extractProtectedClaims('10 bar Water Pump').some((c) => c.kind === 'performance' && /10\s*bar/i.test(c.token))).toBe(
      true,
    );
    expect(extractProtectedClaims('500L Tank').some((c) => c.kind === 'performance' && /500\s*l/i.test(c.token))).toBe(true);
    expect(extractProtectedClaims('IP67 Pump').some((c) => c.kind === 'specification' && /ip\s?67/i.test(c.token))).toBe(
      true,
    );
    expect(extractProtectedClaims('Racing Brake Pad').some((c) => c.kind === 'compatibility' && c.token === 'racing')).toBe(
      true,
    );
  });

  it('blocks material keywords that are not backed by VERIFIED profile facts', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        keywords: ['Stainless Steel Pump', 'Aluminum Water Pump'],
        specifications: { Type: 'Water Pump', Power: '1.5kW' },
        description: 'Industrial water pump for irrigation systems.',
      }),
    );
    const steel = seoFor('Stainless Steel Pump', state);
    const aluminum = seoFor('Aluminum Water Pump', state);
    expect(steel?.status).toBe('BLOCKED');
    expect(steel?.reasons).toContain('MATERIAL_UNVERIFIED');
    expect(aluminum?.status).toBe('BLOCKED');
    expect(aluminum?.reasons).toContain('MATERIAL_UNVERIFIED');
    expect(state.productProfile.materials.some((m) => /stainless|aluminum/i.test(m.value))).toBe(false);
    expect(state.verifiedFacts.some((f) => /stainless steel|aluminum/i.test(f.value) && f.kind === 'material')).toBe(
      false,
    );
  });

  it('accepts a material keyword only when the same material is VERIFIED on the profile', async () => {
    resetToolCache();
    const state = await reasonAboutProduct({
      ...FIXTURES.pump,
      keywords: [...(FIXTURES.pump.keywords ?? []), 'Stainless Steel Pump', 'Aluminum Water Pump'],
    });
    expect(seoFor('Stainless Steel Pump', state)?.reasons ?? []).not.toContain('MATERIAL_UNVERIFIED');
    expect(seoFor('Aluminum Water Pump', state)?.reasons).toContain('MATERIAL_UNVERIFIED');
  });

  it('blocks unverified power, pressure, and capacity performance claims', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        keywords: ['15kW Water Pump', '10 bar Water Pump', '500L Water Pump'],
        specifications: { Type: 'Water Pump' },
        description: 'Industrial water pump for irrigation systems.',
      }),
    );
    for (const keyword of ['15kW Water Pump', '10 bar Water Pump', '500L Water Pump']) {
      const row = seoFor(keyword, state);
      expect(row?.status).toBe('BLOCKED');
      expect(row?.reasons).toContain('PERFORMANCE_UNVERIFIED');
    }
  });

  it('accepts a performance keyword only when the measure is VERIFIED', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        keywords: ['15kW Water Pump', '10 bar Water Pump'],
        specifications: { Type: 'Water Pump', Power: '15kW' },
        description: 'Industrial water pump for irrigation systems.',
      }),
    );
    expect(seoFor('15kW Water Pump', state)?.reasons ?? []).not.toContain('PERFORMANCE_UNVERIFIED');
    expect(seoFor('10 bar Water Pump', state)?.reasons).toContain('PERFORMANCE_UNVERIFIED');
  });

  it('blocks specification tokens such as IP/DN unless a VERIFIED spec contains them', async () => {
    resetToolCache();
    const blocked = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        keywords: ['IP67 Water Pump', 'DN80 Water Pump'],
        specifications: { Type: 'Water Pump' },
        description: 'Industrial water pump for irrigation systems.',
      }),
    );
    expect(seoFor('IP67 Water Pump', blocked)?.reasons).toContain('SPECIFICATION_UNVERIFIED');
    expect(seoFor('DN80 Water Pump', blocked)?.reasons).toContain('SPECIFICATION_UNVERIFIED');

    resetToolCache();
    const verified = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        keywords: ['IP67 Water Pump', 'DN80 Water Pump'],
        specifications: { Type: 'Water Pump', Waterproof: 'IP67' },
        description: 'Industrial water pump for irrigation systems.',
      }),
    );
    expect(seoFor('IP67 Water Pump', verified)?.reasons ?? []).not.toContain('SPECIFICATION_UNVERIFIED');
    expect(seoFor('DN80 Water Pump', verified)?.reasons).toContain('SPECIFICATION_UNVERIFIED');
  });

  it('blocks compatibility markers such as racing/fits without verified evidence', async () => {
    resetToolCache();
    const auto = await reasonAboutProduct(FIXTURES.auto);
    expect(seoFor('Racing Brake Pad', auto)?.status).toBe('BLOCKED');
    expect(seoFor('Racing Brake Pad', auto)?.reasons).toContain('COMPATIBILITY_UNVERIFIED');

    resetToolCache();
    const pump = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        keywords: ['Fits Toyota Water Pump'],
        specifications: { Type: 'Water Pump' },
        description: 'Industrial water pump for irrigation systems.',
      }),
    );
    expect(seoFor('Fits Toyota Water Pump', pump)?.reasons).toContain('COMPATIBILITY_UNVERIFIED');
  });

  it('does not write candidate keywords back into product truth', async () => {
    resetToolCache();
    const page = listing({
      productName: 'Industrial Water Pump',
      title: 'Industrial Water Pump',
      category: 'Water Pump',
      keywords: ['Copper Water Pump', 'Titanium Alloy Pump'],
      specifications: { Type: 'Water Pump' },
      description: 'Industrial water pump for irrigation systems.',
    });
    const state = await reasonAboutProduct(page);
    expect(JSON.stringify(state.verifiedFacts)).not.toMatch(/copper|titanium/i);
    expect(JSON.stringify(state.productProfile.materials)).not.toMatch(/copper|titanium/i);
    const snapshot = JSON.stringify(state.productProfile);
    planKeywords(page, state.productProfile);
    expect(JSON.stringify(state.productProfile)).toBe(snapshot);
    expect(unverifiedClaimReasons('Copper Water Pump', state.productProfile)).toContain('MATERIAL_UNVERIFIED');
  });
});

describe('certification and protected-claim verification by claim type', () => {
  it('does not treat DESCRIPTION as a verifiable source for certifications or protected attributes', () => {
    expect(canVerifyClaim('certification', ['DESCRIPTION'])).toBe(false);
    expect(canVerifyClaim('certification', ['TITLE'])).toBe(false);
    expect(canVerifyClaim('certification', ['SPEC'])).toBe(false);
    expect(canVerifyClaim('certification', ['CERTIFICATION_FIELD'])).toBe(true);
    expect(canVerifyClaim('certification', ['USER'])).toBe(true);
    expect(canVerifyClaim('attribute', ['DESCRIPTION'])).toBe(false);
    expect(canVerifyClaim('attribute', ['SPEC'])).toBe(true);
    expect(canVerifyClaim('material', ['DESCRIPTION'])).toBe(false);
    expect(canVerifyClaim('material', ['SPEC'])).toBe(true);
    expect(canVerifyClaim('performance', ['DESCRIPTION'])).toBe(false);
  });

  it('keeps CE/ISO in ordinary description and title as OBSERVED, never VERIFIED', async () => {
    const page = listing({
      productName: 'Industrial Water Pump',
      title: 'CE ISO 9001 Industrial Water Pump',
      category: 'Water Pump',
      keywords: [],
      specifications: { Type: 'Water Pump' },
      description: 'CE / ISO 9001 certified industrial pump for export.',
      certifications: [],
    });
    const facts = extractFacts(observePage(page));
    const certs = [...facts.verified, ...facts.inferred, ...facts.observed].filter((f) => f.kind === 'certification');
    expect(certs.some((f) => f.status === 'VERIFIED')).toBe(false);
    expect(certs.some((f) => /ce|iso/i.test(f.value) && f.status === 'OBSERVED')).toBe(true);

    resetToolCache();
    const state = await reasonAboutProduct(page);
    expect(state.productProfile.certifications).toEqual([]);
    expect(state.verifiedFacts.some((f) => f.kind === 'certification')).toBe(false);
    expect(state.observedFacts.some((f) => f.kind === 'certification' && /ce|iso/i.test(f.value))).toBe(true);
  });

  it('does not let identityUserVerified promote description certifications to VERIFIED', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(
      listing({
        productName: 'Industrial Water Pump',
        title: 'Industrial Water Pump',
        category: 'Water Pump',
        specifications: { Type: 'Water Pump' },
        description: 'CE / ISO 9001 certified industrial pump.',
        identityUserVerified: true,
      }),
    );
    expect(state.productProfile.certifications).toEqual([]);
    expect(state.verifiedFacts.some((f) => f.kind === 'certification')).toBe(false);
  });

  it('verifies certifications from CERTIFICATION_FIELD, named certification/standard specs, or USER evidence', () => {
    const field = extractFacts(
      observePage(
        listing({
          productName: 'Industrial Water Pump',
          title: 'Industrial Water Pump',
          specifications: { Type: 'Water Pump' },
          description: 'Industrial pump.',
          certifications: ['CE', 'ISO 9001'],
        }),
      ),
    );
    expect(field.verified.some((f) => f.kind === 'certification' && /ce/i.test(f.value))).toBe(true);
    expect(field.verified.some((f) => f.kind === 'certification' && /iso/i.test(f.value))).toBe(true);

    const spec = extractFacts(
      observePage(
        listing({
          productName: 'Industrial Water Pump',
          title: 'Industrial Water Pump',
          specifications: { Type: 'Water Pump', Standard: 'ISO 9001', Certification: 'CE' },
          description: 'Industrial pump.',
          certifications: [],
        }),
      ),
    );
    expect(spec.verified.some((f) => f.kind === 'certification' && /iso 9001/i.test(f.value))).toBe(true);
    expect(spec.verified.some((f) => f.kind === 'certification' && /\bce\b/i.test(f.value))).toBe(true);

    const user = extractFacts([createEvidence('u1', 'USER', 'certification', 'ISO 9001')]);
    expect(user.verified.some((f) => f.kind === 'certification' && /iso 9001/i.test(f.value))).toBe(true);
  });

  it('does not verify protected attributes from description alone', () => {
    const facts = extractFacts(
      observePage(
        listing({
          productName: 'Safety Vest',
          title: 'Safety Vest',
          specifications: { Type: 'Safety Vest' },
          description: 'Waterproof eco-friendly vest for outdoor use.',
        }),
      ),
    );
    const waterproof = [...facts.verified, ...facts.inferred, ...facts.observed].find((f) =>
      /waterproof/i.test(f.value),
    );
    expect(waterproof?.status).toBe('INFERRED');
    expect(facts.verified.some((f) => /waterproof|eco/i.test(f.value) && f.kind === 'attribute')).toBe(false);
  });
});
