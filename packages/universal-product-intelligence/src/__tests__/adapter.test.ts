import { describe, expect, it } from 'vitest';
import { reasonAboutProduct, toProductTruthProfile } from '../index';
import { FIXTURES } from './fixtures';

describe('V1 ProductTruthProfile adapter', () => {
  it('maps UPI state to the existing truth profile without using keywords as evidence', async () => {
    const state = await reasonAboutProduct(FIXTURES.vacuum);
    const profile = toProductTruthProfile(state, FIXTURES.vacuum);
    expect(profile.coreProduct.length).toBeGreaterThan(3);
    expect(profile.evidence.every((e) => e.source !== 'UNKNOWN' || !/keyword/i.test(e.field))).toBe(true);
    expect(profile.unverifiedClaims.some((c) => /eco|hospital/i.test(c))).toBe(true);
    expect(profile.userVerified).toBe(false);
  });
});
