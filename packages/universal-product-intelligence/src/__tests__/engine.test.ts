import { describe, expect, it } from 'vitest';
import { emptyPageData } from '@trade-ai/shared-types';
import { reasonAboutProduct, resetToolCache } from '../index';
import { FIXTURES } from './fixtures';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine');

function assertNoInventedSearch(state: Awaited<ReturnType<typeof reasonAboutProduct>>) {
  expect(state.seo.searchDemand === 'UNKNOWN' || state.seo.searchDemand === 'NOT_AVAILABLE').toBe(true);
  expect(state.seo.officialTop3).toEqual([]);
  expect(state.seo.autoApplyAllowed).toBe(false);
  const blob = JSON.stringify(state);
  expect(blob).not.toMatch(/"demand":\s*[0-9]/);
  expect(blob).not.toMatch(/"searchVolume"\s*:/);
  expect(blob).not.toMatch(/"monthlySearches"\s*:/);
  expect(blob).not.toMatch(/"cpc"\s*:\s*[0-9]/);
}

describe('Universal engine has no per-product branches', () => {
  it('does not hard-code fixture product names in the reasoning engine', () => {
    const files = [
      'orchestrator.ts',
      'hypothesis.ts',
      'conflicts.ts',
      'observe.ts',
      'planner.ts',
      'reflector.ts',
      'confidence.ts',
      'product-profile.ts',
      'state.ts',
      'evidence.ts',
      'tools.ts',
    ];
    const joined = files.map((f) => readFileSync(join(engineDir, f), 'utf8')).join('\n').toLowerCase();
    for (const banned of ['vacuum cleaner', 'steam cleaner', 'cnc milling', 'brake pad', 'dining chair']) {
      expect(joined.includes(banned)).toBe(false);
    }
  });
});

describe('10 cross-category fixtures share one engine', () => {
  it.each(Object.entries(FIXTURES))('%s: identity, attributes, evidence, unknowns, conflicts, no fiction, seo gate', async (name, page) => {
    resetToolCache();
    const state = await reasonAboutProduct(page);
    expect(state.finalized).toBe(true);
    expect(state.productProfile.identity.candidates.length).toBeGreaterThanOrEqual(1);
    expect(state.productProfile.identity.candidates.length).toBeLessThanOrEqual(3);
    expect(state.productProfile.identity.label.length).toBeGreaterThan(3);
    expect(state.confidence.formulaVersion).toBe('UPI_CONF_1.0.0');
    expect(state.confidence.factors).toBeTruthy();
    expect(typeof state.confidence.score).toBe('number');

    for (const fact of state.verifiedFacts) {
      expect(fact.evidenceIds.length).toBeGreaterThan(0);
      expect(fact.status).toBe('VERIFIED');
    }
    expect(state.unknowns.length).toBeGreaterThan(0);
    expect(state.tools.some((t) => t.tool === 'imageAnalyzer' && t.status === 'UNAVAILABLE')).toBe(true);
    expect(state.tools.some((t) => t.tool === 'searchDataProvider' && t.status === 'UNAVAILABLE')).toBe(true);
    assertNoInventedSearch(state);
    expect(state.productProfile.visualFacts.every((f) => f.status !== 'VERIFIED')).toBe(true);

    if (name === 'vacuum') {
      expect(state.status).toBe('CONFLICT');
      expect(state.seo.canProceed).toBe(false);
      expect(state.productProfile.identity.label).toMatch(/vacuum|cleaner/i);
      expect(state.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH')).toBe(true);
    }
    if (name === 'aluminum') {
      expect(state.conflicts.some((c) => c.code === 'MATERIAL_CONFLICT')).toBe(true);
      expect(state.seo.autoApplyAllowed).toBe(false);
    }
    if (name === 'led') {
      expect(state.productProfile.dynamicAttributes.some((a) => a.name.includes('waterproof') && a.status === 'VERIFIED')).toBe(true);
    }
    if (name === 'pump') {
      expect(state.productProfile.identity.label).toMatch(/pump/i);
    }
    if (name === 'auto') {
      expect(state.productProfile.identity.label).toMatch(/pad|brake/i);
    }
    if (name === 'pump' || name === 'valve' || name === 'furniture' || name === 'packaging' || name === 'auto' || name === 'cnc' || name === 'vest') {
      expect(['LIKELY', 'CONFIRMED', 'UNCERTAIN']).toContain(state.status);
    }
  });
});

describe('keyword self-attestation and protected claims', () => {
  it('does not let keywords verify eco-friendly, hospital, ISO, or food-grade', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(FIXTURES.vacuum);
    const attrs = state.productProfile.dynamicAttributes;
    expect(attrs.find((a) => a.name.includes('eco'))?.status).toBe('OBSERVED');
    expect(state.verifiedFacts.some((f) => /eco/i.test(f.value) && f.status === 'VERIFIED')).toBe(false);
    expect(state.verifiedFacts.some((f) => /hospital/i.test(f.value) && f.kind === 'application')).toBe(false);
    expect(state.productProfile.certifications.join(' ')).not.toMatch(/iso/i);
    expect(state.conflicts.some((c) => c.code === 'UNSUPPORTED_CLAIM' && /eco/i.test(c.summary))).toBe(true);
    expect(state.conflicts.some((c) => c.code === 'UNSUPPORTED_CLAIM' && /hospital/i.test(c.summary))).toBe(true);
  });

  it('blocks certification/application/material/performance self-attestation on other fixtures', async () => {
    resetToolCache();
    const pump = await reasonAboutProduct(FIXTURES.pump);
    expect(pump.productProfile.certifications.every((c) => c.status === 'VERIFIED')).toBe(true);
    expect(JSON.stringify(pump.productProfile.certifications)).not.toMatch(/iso 9001/i);

    const vest = await reasonAboutProduct(FIXTURES.vest);
    expect(vest.productProfile.dynamicAttributes.find((a) => a.name.includes('waterproof'))?.status).not.toBe('VERIFIED');

    const valve = await reasonAboutProduct(FIXTURES.valve);
    expect(valve.productProfile.certifications).toEqual([]);
    expect(valve.conflicts.some((c) => /food grade|ce /i.test(c.summary) || c.right === 'food grade' || c.right === 'certification')).toBe(true);
  });

  it('keeps title vs spec material conflict', async () => {
    const state = await reasonAboutProduct(FIXTURES.aluminum);
    expect(state.conflicts.some((c) => c.code === 'MATERIAL_CONFLICT')).toBe(true);
    expect(state.seo.autoApplyAllowed).toBe(false);
  });

  it('does not auto-apply at low confidence or conflict', async () => {
    const vacuum = await reasonAboutProduct(FIXTURES.vacuum);
    expect(vacuum.seo.autoApplyAllowed).toBe(false);
    const thin = await reasonAboutProduct(
      emptyPageData({
        platform: 'MADE_IN_CHINA',
        pageType: 'MIC_PRODUCT_EDIT',
        productName: 'Industrial Unit',
        title: 'Industrial Unit',
        category: '',
        keywords: ['Eco-Friendly Unit'],
      }),
    );
    expect(thin.confidence.score).toBeLessThan(0.8);
    expect(thin.seo.autoApplyAllowed).toBe(false);
  });

  it('degrades when image and search tools fail', async () => {
    resetToolCache();
    const state = await reasonAboutProduct(FIXTURES.furniture);
    expect(state.finalized).toBe(true);
    expect(state.productProfile.identity.label).toMatch(/chair/i);
    expect(state.tools.every((t) => t.status === 'UNAVAILABLE')).toBe(true);
    expect(state.unknowns.some((u) => u.slot === 'imageAnalyzer')).toBe(true);
    expect(state.unknowns.some((u) => u.slot === 'searchDataProvider')).toBe(true);
    expect(state.seo.officialTop3).toEqual([]);
  });

  it('userVerified does not let keywords attest eco-friendly', async () => {
    const state = await reasonAboutProduct({ ...FIXTURES.vacuum, identityUserVerified: true });
    expect(state.productProfile.dynamicAttributes.find((a) => a.name.includes('eco'))?.status).toBe('OBSERVED');
    expect(state.status).toBe('CONFIRMED');
    expect(state.seo.autoApplyAllowed).toBe(false);
  });

  it('keeps translation prompt files untouched and unimported', () => {
    const files = [
      'orchestrator.ts',
      'hypothesis.ts',
      'conflicts.ts',
      'observe.ts',
      'planner.ts',
      'reflector.ts',
      'confidence.ts',
      'product-profile.ts',
      'state.ts',
      'evidence.ts',
      'tools.ts',
    ];
    const joined = files.map((f) => readFileSync(join(engineDir, f), 'utf8')).join('\n');
    expect(joined).not.toMatch('buildTitleOptimizerUserPrompt');
    expect(joined).not.toMatch('@trade-ai/prompts');
    expect(joined).not.toMatch('PRODUCT_FAMILY_CATALOG');
    const titlePrompt = readFileSync(
      join(engineDir, '../../../prompts/src/mic/title-optimizer.ts'),
      'utf8',
    );
    expect(titlePrompt).toMatch('Natural English');
    expect(titlePrompt).toMatch('Do not invent certifications');
  });

  it('records OBSERVE / CHECK / CHALLENGE / REVISE / FINALIZE without chain-of-thought', async () => {
    const state = await reasonAboutProduct(FIXTURES.pump);
    const phases = state.steps.map((s) => s.phase);
    expect(phases).toContain('OBSERVE');
    expect(phases).toContain('GENERATE_HYPOTHESES');
    expect(phases).toContain('CHECK_EVIDENCE');
    expect(phases).toContain('CHALLENGE');
    expect(phases).toContain('REVISE');
    expect(phases).toContain('FINALIZE');
    expect(JSON.stringify(state.steps)).not.toMatch(/let me think|chain of thought|internal monologue/i);
  });
});
