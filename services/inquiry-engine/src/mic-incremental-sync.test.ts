import { describe, expect, it } from 'vitest';
import { applyIncrementalProducts, emptyCursor } from './sync';
import type { MICVirtualOfficeData } from '@trade-ai/shared-types';

describe('mic-incremental-sync', () => {
  it('counts unchanged hashes', () => {
    const data = {
      products: [{ micProductId: 'P1', rawSourceHash: 'abc' }],
      syncMeta: { mode: 'INCREMENTAL', modules: [], startedAt: '', source: 'FIXTURE' },
    } as unknown as MICVirtualOfficeData;
    const cursor = emptyCursor();
    cursor.productHashes.P1 = 'abc';
    expect(applyIncrementalProducts(data, cursor).unchanged).toBe(1);
  });
});
