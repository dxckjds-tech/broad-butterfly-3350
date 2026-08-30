import { describe, expect, it } from 'vitest';
import { productKey } from '../shared/hash';

describe('mic-product-dedup', () => {
  it('uses stable provisional key without title-only', () => {
    const a = productKey('', 'https://x/p', 'A');
    const b = productKey('', 'https://y/p', 'A');
    expect(a.key).not.toBe(b.key);
  });
});
